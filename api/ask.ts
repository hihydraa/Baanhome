import { GoogleGenAI } from '@google/genai';
import { setCorsHeaders } from '../lib/cors.js';
import { askDeepSeek } from '../lib/deepseek.js';

function cleanCustomerResponse(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:\r?\n)*\s*(?:\(|\[)?\s*(?:อ้างอิงจากรหัสข้อมูล|อ้างอิงจากข้อมูล|อ้างอิงรหัสข้อมูล|อ้างอิงรหัส|อ้างอิงข้อมูล|อ้างอิง|Reference|Ref\.?)\s*[:：]?\s*[\w\-\s,]+(?:\)|\])?/gi, '')
    .replace(/(?:\r?\n)+\s*(?:\(|\[)?\s*(?:BH|KH|KB|RM|REST|MICE|PROMO)-\d+(?:\)|\])?\s*$/gi, '')
    .trim();
}

async function generateAiContentWithFallback(
  ai: GoogleGenAI,
  contents: any,
  config?: any
): Promise<string> {
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ].filter(Boolean) as string[];

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

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const { query, contextItems } = req.body || {};

  try {
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      const answerText = await askDeepSeek(deepseekKey, query, contextItems);
      const referenceIds = Array.isArray(contextItems) ? contextItems.map((c: any) => c.id) : [];
      return res.status(200).json({ answer: cleanCustomerResponse(answerText), referenceIds });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Missing GEMINI_API_KEY',
        fallbackMessage: 'ไม่สามารถติดต่อผู้ช่วย AI ได้เนื่องจากยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Environment Variables ของ Vercel',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

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

    return res.status(200).json({ answer: cleanAnswer, referenceIds });
  } catch (error: any) {
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

    return res.status(200).json({
      answer: cleanCustomerResponse(fallbackText),
      referenceIds: Array.isArray(contextItems) ? contextItems.map((c: any) => c.id) : [],
      isFallback: true,
    });
  }
}
