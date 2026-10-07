import nongHomeAnalytics from './api/nong-home-analytics.js';
import centralB2B from './api/sync/b2b.js';
import centralUsers from './api/sync/users.js';
import { applyB2BMutation } from './lib/b2bMutation.js';
import { askDeepSeek } from './lib/deepseek.js';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

// Resilient model invocation with automatic fallbacks for 503 (high demand) / 429 (rate limits)
function cleanCustomerResponse(text: string): string {
  if (!text) return '';
  return text
    // Remove lines like "อ้างอิงจากรหัสข้อมูล: KH-040", "(อ้างอิง: KH-040)"
    .replace(/(?:\r?\n)*\s*(?:\(|\[)?\s*(?:อ้างอิงจากรหัสข้อมูล|อ้างอิงจากข้อมูล|อ้างอิงรหัสข้อมูล|อ้างอิงรหัส|อ้างอิงข้อมูล|อ้างอิง|Reference|Ref\.?)\s*[:：]?\s*[\w\-\s,]+(?:\)|\])?/gi, '')
    // Remove any trailing lines that are just standalone item IDs like "KH-040"
    .replace(/(?:\r?\n)+\s*(?:\(|\[)?\s*(?:BH|KH|KB|RM|REST|MICE|PROMO)-\d+(?:\)|\])?\s*$/gi, '')
    .trim();
}

async function generateAiContentWithFallback(
  ai: GoogleGenAI,
  contents: any,
  config?: any
): Promise<string> {
  // Ordered from best primary to high-availability lightweight backup
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ].filter(Boolean) as string[];

  // Deduplicate
  const candidateModels = Array.from(new Set(models));
  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i];
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents,
        config: config || { temperature: 0.2 },
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const statusCode = err?.status || err?.code;
      const errorMsg = String(err?.message || '');

      // Check if transient unavailable (503), rate-limited (429), or 404
      const isTransient =
        statusCode === 503 ||
        statusCode === 429 ||
        statusCode === 404 ||
        errorMsg.includes('503') ||
        errorMsg.includes('high demand') ||
        errorMsg.includes('429') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('UNAVAILABLE') ||
        errorMsg.includes('NOT_FOUND') ||
        errorMsg.includes('404');

      if (isTransient && i < candidateModels.length - 1) {
        // Brief exponential backoff before attempting next resilient candidate
        await new Promise((resolve) => setTimeout(resolve, 350 * (i + 1)));
        continue;
      }

      if (i < candidateModels.length - 1) {
        continue;
      }
    }
  }

  throw lastError || new Error('All AI models unavailable');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.post('/api/nong-home-analytics', nongHomeAnalytics);

  app.get('/api/ask', (_req, res) => {
    const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      activeProvider: hasDeepSeek ? 'deepseek' : hasGemini ? 'gemini' : 'none',
      deepseekKeyConfigured: hasDeepSeek,
      geminiKeyConfigured: hasGemini,
    });
  });

  // AI API Route
  app.post('/api/ask', async (req, res) => {
    const { query, contextItems } = req.body || {};
    try {
      if (process.env.DEEPSEEK_API_KEY) {
        const answerText = await askDeepSeek(process.env.DEEPSEEK_API_KEY, query, contextItems);
        const referenceIds = Array.isArray(contextItems) ? contextItems.map((c: any) => c.id) : [];
        return res.json({ answer: cleanCustomerResponse(answerText), referenceIds });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Missing GEMINI_API_KEY',
          fallbackMessage: 'ไม่สามารถติดต่อผู้ช่วย AI ได้เนื่องจากไม่ได้ตั้งค่า API Key' 
        });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Construct Prompt
      const contextText = Array.isArray(contextItems)
        ? contextItems.map((item: any) => `
ID: ${item.id}
หมวดหมู่: ${item.category}
หัวข้อ: ${item.title}
ข้อความสำหรับตอบลูกค้า: ${item.customerMessage || item.customerScript || item.summary || ''}
        `).join('\n\n')
        : '';

      const systemInstruction = `คุณคือ "น้องโฮม" ผู้ช่วย AI ของพนักงาน "บ้านโฮม" (บริการสวนอาหาร รีสอร์ท พูลวิลล่า และจัดเลี้ยง)
บุคลิกภาพ: เป็นผู้หญิง สุภาพ อบอุ่น เป็นมืออาชีพ ใช้คำลงท้ายว่า "ค่ะ/นะคะ" และใช้อีโมจิอย่างพอดี (1-2 ตัวต่อข้อความ)

หน้าที่ของคุณคือตอบคำถามจากพนักงาน โดยใช้ข้อมูลในฐานความรู้ (Context) ที่ให้มาเท่านั้น
กฎเหล็ก:
1. ให้ใช้ข้อมูลจาก "ข้อความสำหรับตอบลูกค้า" เป็นหลัก
2. ห้ามแต่งเติมราคา ส่วนลด เวลา เงื่อนไข นโยบาย หรือบริการที่ไม่มีในฐานความรู้เด็ดขาด
3. หากมีข้อมูลไม่ครบถ้วน หรือมีเงื่อนไขขัดแย้ง ให้แจ้งว่า: "ข้อมูลส่วนนี้ขออนุญาตตรวจสอบกับเจ้าหน้าที่ก่อนนะคะ เพื่อแจ้งรายละเอียดให้ถูกต้องค่ะ 💚"
4. หากเป็นการเข้าพักก่อนเวลา (Early Check-in) ต้องแยกแยะระหว่างรีสอร์ทกับพูลวิลล่า ห้ามเอาเงื่อนไขรีสอร์ทไปตอบแทนพูลวิลล่า หากไม่มีข้อมูลที่เจาะจง ให้แจ้งว่าต้องตรวจสอบก่อน
5. ข้อความตอบกลับต้องเป็นข้อความสำหรับส่งให้ลูกค้าโดยตรงเท่านั้น ห้ามใส่คำว่า "อ้างอิงจากรหัสข้อมูล:", "รหัส:", "ID:" หรือระบุรหัสข้อมูล (เช่น BH-001, KH-040) ปะปนในข้อความเด็ดขาด เพื่อให้พนักงานกดคัดลอกส่งให้ลูกค้าได้ทันที

ฐานความรู้ (Context):
${contextText}

คำถามจากพนักงาน: ${query}`;

      const answerText = await generateAiContentWithFallback(ai, systemInstruction, {
        temperature: 0.2,
      });

      const cleanAnswer = cleanCustomerResponse(answerText);
      const referenceIds = Array.isArray(contextItems) ? contextItems.map((c: any) => c.id) : [];

      res.json({ answer: cleanAnswer, referenceIds });
    } catch (error: any) {
      console.error('[api/ask] AI request failed:', error?.message || error);
      // Graceful smart context fallback without throwing unhandled exceptions
      let fallbackText = '';
      if (Array.isArray(contextItems) && contextItems.length > 0) {
        const topItem = contextItems[0];
        if (topItem.customerScript) {
          fallbackText = topItem.customerScript;
        } else if (topItem.customerMessage) {
          fallbackText = topItem.customerMessage;
        } else if (topItem.summary) {
          fallbackText = `สวัสดีค่ะ สำหรับเรื่อง${topItem.title} ${topItem.summary} ค่ะ 💚`;
        }
      }

      if (!fallbackText) {
        fallbackText = 'ขณะนี้ระบบน้องโฮม AI อยู่ระหว่างอัปเดตข้อมูล กรุณาใช้ข้อความจากผลการค้นหาด้านล่างส่งให้ลูกค้าได้โดยตรงเลยนะคะ 💚';
      }

      res.json({ 
        answer: cleanCustomerResponse(fallbackText),
        referenceIds: Array.isArray(contextItems) ? contextItems.map((c: any) => c.id) : [],
        isFallback: true,
        fallbackReason: String(error?.name === 'TimeoutError' ? 'timeout' : error?.message || 'unknown').slice(0, 200)
      });
    }
  });

  // Intent parsing route with fallback
  app.post('/api/parse-intent', async (req, res) => {
    const query = req.body?.query || '';
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Missing API Key' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `วิเคราะห์คำถามนี้: "${query}"
คืนค่าเป็น JSON เท่านั้นในรูปแบบ:
{
  "intent": "เรื่องที่ถาม",
  "serviceType": "resort | pool-villa | restaurant | catering | unknown",
  "hasCondition": boolean,
  "needsClarification": boolean
}`;

      const answerJson = await generateAiContentWithFallback(ai, prompt, {
        responseMimeType: 'application/json',
        temperature: 0.1,
      });

      res.json(JSON.parse(answerJson));
    } catch (error: any) {
      // Safe fallback intent
      res.json({
        intent: query || 'ทั่วไป',
        serviceType: 'unknown',
        hasCondition: false,
        needsClarification: false,
      });
    }
  });

  // Shared Data Persistence Store (Sync across all tabs, preview iframe, and shared links)
  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
  }
  const USERS_FILE = path.join(DATA_DIR, 'persistent_users.json');
  const ACTIVITIES_FILE = path.join(DATA_DIR, 'persistent_activities.json');

  const INITIAL_SHARED_USERS = [
    {
      id: 'usr_best',
      username: 'best',
      name: 'best',
      department: 'ช่างและปฏิบัติการ (Engineering & Operations)',
      role: 'Administrator',
      status: 'active',
      avatar: '🧑🏻‍💼',
      passwordHash: 'e32e70df43cf2288920a3555652178fc758c60a5e686e0615e95cb18df617c4e',
      createdAt: '2026-09-20 14:50:00',
      lastLoginAt: null,
    },
    {
      id: 'usr_candy',
      username: 'cansuzy3',
      name: 'Candy',
      department: 'ช่างและปฏิบัติการ (Engineering & Operations)',
      role: 'Administrator',
      status: 'active',
      avatar: '🧑🏻‍💼',
      passwordHash: 'd93028673bae1ae8f8296bf87a2d05d9407ba69427da36d7a073e6e6c06c786d',
      createdAt: '2026-09-19 14:48:00',
      lastLoginAt: '2026-09-19 14:49:15',
    },
    {
      id: 'usr_admin',
      username: 'admin',
      name: 'คุณผู้จัดการศิริชัย (Admin)',
      department: 'ฝ่ายขายและการตลาด (Sales & MICE)',
      role: 'Administrator',
      status: 'active',
      avatar: '👨🏻‍💼',
      passwordHash: '9dbcd8e2eef014a070e1713d9657b98d287ef3e3d937107db71fb3426e0e2c81',
      createdAt: '2026-03-01 08:00:00',
      lastLoginAt: '2026-09-19 14:49:15',
    }
  ];

  app.all('/api/sync/users', centralUsers);
  app.all('/api/sync/b2b', centralB2B);

  app.get('/api/sync/users', (req, res) => {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.json({ users: parsed });
        }
      }
    } catch (e) {
      console.error('Failed reading users file', e);
    }
    res.json({ users: INITIAL_SHARED_USERS });
  });

  app.post('/api/sync/users', (req, res) => {
    try {
      const { users } = req.body || {};
      if (Array.isArray(users)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
        return res.json({ success: true, count: users.length });
      }
      res.status(400).json({ error: 'Invalid users array' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sync/activities', (req, res) => {
    try {
      if (fs.existsSync(ACTIVITIES_FILE)) {
        const raw = fs.readFileSync(ACTIVITIES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return res.json({ activities: parsed });
        }
      }
    } catch (e) {}
    res.json({ activities: [] });
  });

  app.post('/api/sync/activities', (req, res) => {
    try {
      const { activity } = req.body || {};
      if (activity && activity.id) {
        let existing: any[] = [];
        if (fs.existsSync(ACTIVITIES_FILE)) {
          try {
            existing = JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf-8'));
          } catch (e) {}
        }
        existing = [activity, ...existing.filter((a) => a.id !== activity.id)].slice(0, 300);
        fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(existing, null, 2), 'utf-8');
        return res.json({ success: true });
      }
      res.status(400).json({ error: 'Invalid activity' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Question Logs & Unanswered Questions Sync
  const QUESTION_LOGS_FILE = path.join(DATA_DIR, 'persistent_question_logs.json');
  const UNANSWERED_FILE = path.join(DATA_DIR, 'persistent_unanswered.json');

  app.get('/api/sync/question-logs', (req, res) => {
    try {
      if (fs.existsSync(QUESTION_LOGS_FILE)) {
        const raw = fs.readFileSync(QUESTION_LOGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return res.json({ logs: parsed });
      }
    } catch (e) {}
    res.json({ logs: [] });
  });

  app.post('/api/sync/question-logs', (req, res) => {
    try {
      const { logs } = req.body || {};
      if (Array.isArray(logs)) {
        fs.writeFileSync(QUESTION_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
        return res.json({ success: true });
      }
      res.status(400).json({ error: 'Invalid logs' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sync/unanswered', (req, res) => {
    try {
      if (fs.existsSync(UNANSWERED_FILE)) {
        const raw = fs.readFileSync(UNANSWERED_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return res.json({ questions: parsed });
      }
    } catch (e) {}
    res.json({ questions: [] });
  });

  app.post('/api/sync/unanswered', (req, res) => {
    try {
      const { questions } = req.body || {};
      if (Array.isArray(questions)) {
        fs.writeFileSync(UNANSWERED_FILE, JSON.stringify(questions, null, 2), 'utf-8');
        return res.json({ success: true });
      }
      res.status(400).json({ error: 'Invalid questions' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // B2B Leads & Appointments Sync
  const B2B_LEADS_FILE = path.join(DATA_DIR, 'persistent_b2b_leads.json');
  const B2B_APPOINTMENTS_FILE = path.join(DATA_DIR, 'persistent_b2b_appointments.json');

  app.get('/api/sync/b2b', (req, res) => {
    let leads: any[] = [];
    let appointments: any[] = [];
    try {
      if (fs.existsSync(B2B_LEADS_FILE)) {
        leads = JSON.parse(fs.readFileSync(B2B_LEADS_FILE, 'utf-8'));
      }
      if (fs.existsSync(B2B_APPOINTMENTS_FILE)) {
        appointments = JSON.parse(fs.readFileSync(B2B_APPOINTMENTS_FILE, 'utf-8'));
      }
    } catch (e) {}
    res.json({ leads, appointments });
  });

  app.post('/api/sync/b2b', (req, res) => {
    try {
      const current = {
        leads: fs.existsSync(B2B_LEADS_FILE) ? JSON.parse(fs.readFileSync(B2B_LEADS_FILE, 'utf-8')) : [],
        appointments: fs.existsSync(B2B_APPOINTMENTS_FILE) ? JSON.parse(fs.readFileSync(B2B_APPOINTMENTS_FILE, 'utf-8')) : [],
      };
      const updated = applyB2BMutation(current, req.body);
      fs.writeFileSync(B2B_LEADS_FILE, JSON.stringify(updated.leads, null, 2), 'utf-8');
      fs.writeFileSync(B2B_APPOINTMENTS_FILE, JSON.stringify(updated.appointments, null, 2), 'utf-8');
      res.json({ success: true, ...updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Custom Knowledge Base Items (Google Sheets sync)
  const KNOWLEDGE_FILE = path.join(DATA_DIR, 'persistent_knowledge.json');

  app.get('/api/sync/knowledge', (req, res) => {
    try {
      if (fs.existsSync(KNOWLEDGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
        return res.json(data);
      }
    } catch (e) {}
    res.json({ items: null, sheetUrl: '', lastSynced: null });
  });

  app.post('/api/sync/knowledge', (req, res) => {
    try {
      const payload = req.body || {};
      fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Departments Sync
  const DEPARTMENTS_FILE = path.join(DATA_DIR, 'persistent_departments.json');

  app.get('/api/sync/departments', (req, res) => {
    try {
      if (fs.existsSync(DEPARTMENTS_FILE)) {
        const raw = fs.readFileSync(DEPARTMENTS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return res.json({ departments: parsed });
      }
    } catch (e) {}
    res.json({ departments: [] });
  });

  app.post('/api/sync/departments', (req, res) => {
    try {
      const { departments } = req.body || {};
      if (Array.isArray(departments)) {
        fs.writeFileSync(DEPARTMENTS_FILE, JSON.stringify(departments, null, 2), 'utf-8');
        return res.json({ success: true });
      }
      res.status(400).json({ error: 'Invalid departments' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Custom Images Sync
  const CUSTOM_IMAGES_FILE = path.join(DATA_DIR, 'persistent_custom_images.json');

  app.get('/api/sync/custom-images', (req, res) => {
    try {
      if (fs.existsSync(CUSTOM_IMAGES_FILE)) {
        const raw = fs.readFileSync(CUSTOM_IMAGES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return res.json({ images: parsed });
      }
    } catch (e) {}
    res.json({ images: {} });
  });

  app.post('/api/sync/custom-images', (req, res) => {
    try {
      const { images } = req.body || {};
      if (images && typeof images === 'object') {
        fs.writeFileSync(CUSTOM_IMAGES_FILE, JSON.stringify(images, null, 2), 'utf-8');
        return res.json({ success: true });
      }
      res.status(400).json({ error: 'Invalid images map' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Central Google Sheets Database Configuration Sync
  const SHEETS_CONFIG_FILE = path.join(DATA_DIR, 'persistent_sheets_db_config.json');

  app.get('/api/sync/sheets-config', (req, res) => {
    try {
      if (fs.existsSync(SHEETS_CONFIG_FILE)) {
        const raw = fs.readFileSync(SHEETS_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return res.json({ config: parsed });
      }
    } catch (e) {}
    res.json({ config: null });
  });

  app.post('/api/sync/sheets-config', (req, res) => {
    try {
      const { config } = req.body || {};
      if (config === null) {
        if (fs.existsSync(SHEETS_CONFIG_FILE)) {
          fs.unlinkSync(SHEETS_CONFIG_FILE);
        }
        return res.json({ success: true, config: null });
      }
      if (config && typeof config === 'object') {
        fs.writeFileSync(SHEETS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        return res.json({ success: true, config });
      }
      res.status(400).json({ error: 'Invalid config' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
