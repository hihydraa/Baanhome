import { KnowledgeItem, KnowledgeCategory, AudienceType, DataStatusType } from '../types';
import { KNOWLEDGE_BASE_ITEMS } from '../data/knowledgeBase';
import { BROCHURE_KNOWLEDGE_ITEMS } from '../data/brochureKnowledgeItems';
import { isCompetitorKnowledge } from './knowledgeFilter';

const STORAGE_KEY_ITEMS = 'nonghome_synced_knowledge_items';
const STORAGE_KEY_URL = 'nonghome_synced_sheet_url';
const STORAGE_KEY_LAST_SYNC = 'nonghome_synced_last_time';

export function extractGoogleSheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

export function normalizeCategory(catStr: string): KnowledgeCategory {
  const clean = catStr.trim().toLowerCase();
  if (clean.includes('จอง') || clean.includes('reservation')) return 'reservation';
  if (clean.includes('อาหาร') || clean.includes('restaurant') || clean.includes('เมนู')) return 'restaurant';
  if (clean.includes('พูลวิลล่า') || clean.includes('pool-villa') || clean.includes('pool')) return 'pool-villa';
  if (clean.includes('รีสอร์ท') || clean.includes('สัตว์เลี้ยง') || clean.includes('resort')) return 'resort-knowledge';
  if (clean.includes('สัมมนา') || clean.includes('mice') || clean.includes('ประชุม')) return 'mini-mice';
  if (clean.includes('โปรโมชั่น') || clean.includes('package') || clean.includes('แพ็กเกจ')) return 'promotion-package';
  if (clean.includes('บริการ') || clean.includes('ลูกค้า') || clean.includes('customer')) return 'customer-service';
  if (clean.includes('sop') || clean.includes('ปฏิบัติงาน') || clean.includes('แม่บ้าน') || clean.includes('operation')) return 'sop-operation';
  if (clean.includes('ปัญหา') || clean.includes('faq') || clean.includes('แก้ปัญหา')) return 'faq-problems';
  if (clean.includes('ประวัติ') || clean.includes('business') || clean.includes('แบรนด์') || clean.includes('ที่ตั้ง')) return 'business-profile';
  if (clean.includes('สวัสดิการ') || clean.includes('พนักงาน') || clean.includes('employee')) return 'employee-welfare';
  if (clean.includes('kc') || clean.includes('เครือ')) return 'kc-corporation';
  return 'reservation';
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

export function convertRowsToKnowledgeItems(rows: string[][]): KnowledgeItem[] {
  if (rows.length === 0) return [];
  
  const firstRow = rows[0].map((c) => c.toLowerCase().trim());
  const hasHeader = firstRow.some(
    (c) =>
      c.includes('id') ||
      c.includes('category') ||
      c.includes('หัวข้อ') ||
      c.includes('keywords')
  );

  let idIdx = -1, catIdx = -1, titleIdx = -1, keywordsIdx = -1,
      audienceIdx = -1, staffAnswerIdx = -1, customerMsgIdx = -1,
      detailIdx = -1, actionsIdx = -1, dataStatusIdx = -1,
      statusIdx = -1, aiUsableIdx = -1, sourceIdx = -1,
      updatedIdx = -1, startIdx = -1, endIdx = -1;

  if (hasHeader) {
    firstRow.forEach((colName, idx) => {
      if (colName === 'id') idIdx = idx;
      else if (colName.includes('category')) catIdx = idx;
      else if (colName.includes('audience')) audienceIdx = idx;
      else if (colName.includes('หัวข้อ') || colName.includes('คำถาม')) titleIdx = idx;
      else if (colName.includes('keywords')) keywordsIdx = idx;
      else if (colName.includes('คำตอบสำหรับพนักงาน')) staffAnswerIdx = idx;
      else if (colName.includes('ข้อความพร้อมส่งลูกค้า')) customerMsgIdx = idx;
      else if (colName.includes('รายละเอียด') || colName.includes('เงื่อนไข')) detailIdx = idx;
      else if (colName.includes('สิ่งที่ต้องทำต่อ')) actionsIdx = idx;
      else if (colName.includes('data status') || colName.includes('data_status')) dataStatusIdx = idx;
      else if (colName === 'status') statusIdx = idx;
      else if (colName.includes('ai usable') || colName.includes('ai_usable')) aiUsableIdx = idx;
      else if (colName.includes('source')) sourceIdx = idx;
      else if (colName.includes('last updated')) updatedIdx = idx;
      else if (colName.includes('start date')) startIdx = idx;
      else if (colName.includes('end date')) endIdx = idx;
    });
  } else {
    // Default indices if no header (fallback)
    idIdx = 0; catIdx = 1; titleIdx = 2; keywordsIdx = 3;
    customerMsgIdx = 4; staffAnswerIdx = 5; detailIdx = 6; actionsIdx = 7;
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((row, index) => {
      const getVal = (idx: number) => (idx >= 0 && row[idx]) ? row[idx].trim() : '';

      const itemId = getVal(idIdx) || `BH-${String(index + 1).padStart(3, '0')}`;
      const category = normalizeCategory(getVal(catIdx));
      
      const rawAudience = getVal(audienceIdx);
      const audience = (rawAudience as AudienceType) || 'Both';
      
      const title = getVal(titleIdx);
      const rawKeywords = getVal(keywordsIdx);
      const keywords = rawKeywords
        ? rawKeywords.split(/[,、|]/).map((k) => k.trim()).filter(Boolean)
        : [title];
      
      const staffAnswer = getVal(staffAnswerIdx);
      const customerMessage = getVal(customerMsgIdx);
      
      const rawDetails = getVal(detailIdx);
      const detail = rawDetails ? rawDetails.split(/[\r\n|]+/).map((d) => d.trim()).filter(Boolean) : [];
      
      const rawActions = getVal(actionsIdx);
      const nextActions = rawActions ? rawActions.split(/[\r\n|]+/).map((a) => a.trim()).filter(Boolean) : [];

      const rawDataStatus = getVal(dataStatusIdx);
      const dataStatus = (rawDataStatus as DataStatusType) || 'Confirmed';

      const rawStatus = getVal(statusIdx);
      const status: any = rawStatus || 'Published';

      const rawAiUsable = getVal(aiUsableIdx);
      const aiUsable: any = rawAiUsable || 'Yes';

      const sourceDoc = getVal(sourceIdx);
      const lastUpdated = getVal(updatedIdx) || new Date().toISOString().split('T')[0];
      const startDate = getVal(startIdx) || undefined;
      const endDate = getVal(endIdx) || undefined;

      const isComp = isCompetitorKnowledge({
        id: itemId,
        category,
        title,
        keywords,
        docSection: sourceDoc,
        summary: staffAnswer,
      });

      const finalAudience = isComp ? 'Employee' : audience;
      const finalStatus = isComp ? 'Internal' : status;
      const finalAiUsable = isComp ? 'Employee Only' : aiUsable;
      const finalCustomerMsg = isComp ? '' : customerMessage;
      const finalCategory = isComp ? 'competitor-battlecard' : category;

      const item: KnowledgeItem = {
        id: itemId,
        category: finalCategory,
        title,
        keywords,
        summary: staffAnswer, // using summary property for staff answer for backward compatibility
        detail,
        customerMessage: finalCustomerMsg,
        nextActions,
        sourceDoc,
        lastUpdated,
        status: finalStatus,
        dataStatus,
        aiUsable: finalAiUsable,
        audience: finalAudience,
        startDate,
        endDate,
        isCompetitorBattlecard: isComp || undefined,
      };

      return item;
    })
    .filter((item) => item.title);
}

export async function fetchGoogleSheet(urlOrId: string): Promise<KnowledgeItem[]> {
  const sheetId = extractGoogleSheetId(urlOrId);
  if (!sheetId) {
    throw new Error('ไม่พบ Google Sheet ID ที่ถูกต้อง กรุณาตรวจสอบลิงก์อีกครั้ง');
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`ไม่สามารถเข้าถึงเอกสารได้ (สถานะ ${res.status})`);
    }
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    const items = convertRowsToKnowledgeItems(rows);
    if (items.length === 0) {
      throw new Error('ไม่พบแถวข้อมูลในตาราง Google Sheets');
    }
    return items;
  } catch (err: any) {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
    try {
      const gvizRes = await fetch(gvizUrl);
      if (!gvizRes.ok) throw err;
      const gvizText = await gvizRes.text();
      const jsonStart = gvizText.indexOf('{');
      const jsonEnd = gvizText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw err;
      const rawJson = JSON.parse(gvizText.substring(jsonStart, jsonEnd + 1));
      const gvizRows: string[][] = [];
      if (rawJson.table && rawJson.table.rows) {
        for (const r of rawJson.table.rows) {
          const rowValues = (r.c || []).map((cell: any) => (cell && cell.v !== undefined ? String(cell.v) : ''));
          gvizRows.push(rowValues);
        }
      }
      const items = convertRowsToKnowledgeItems(gvizRows);
      if (items.length === 0) throw err;
      return items;
    } catch {
      throw new Error('ไม่สามารถดึงข้อมูลอัตโนมัติได้ อาจติดการตั้งค่าความเป็นส่วนตัว');
    }
  }
}

/**
 * รวมความรู้จาก Google Sheet กับรายการจาก PDF (โบรชัวร์ Mini MICE / เล่มเมนู BH 2026)
 * รายการที่ id ซ้ำกัน ให้ยึดของ Google Sheet; ถ้าเนื้อหาขัดกัน AI ถูกสั่งให้ยึด Google Sheet (ดู lib/deepseek.ts)
 */
export function withPdfKnowledge(sheetItems: KnowledgeItem[]): KnowledgeItem[] {
  const ids = new Set(sheetItems.map((i) => i.id));
  return [...sheetItems, ...BROCHURE_KNOWLEDGE_ITEMS.filter((b) => !ids.has(b.id))];
}

export function saveSyncedKnowledgeItems(items: KnowledgeItem[], sheetUrl?: string): void {
  const lastTime = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    if (sheetUrl) {
      localStorage.setItem(STORAGE_KEY_URL, sheetUrl);
    }
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, lastTime);
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }

  // Sync to shared backend server
  try {
    fetch('/api/sync/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        sheetUrl: sheetUrl || getSyncedSheetUrl(),
        lastSynced: lastTime,
      }),
    }).catch(() => {});
  } catch (e) {}
}

export function syncKnowledgeWithServer(onLoaded?: (items: KnowledgeItem[]) => void) {
  try {
    fetch('/api/sync/knowledge')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(data.items));
          if (data.sheetUrl) localStorage.setItem(STORAGE_KEY_URL, data.sheetUrl);
          if (data.lastSynced) localStorage.setItem(STORAGE_KEY_LAST_SYNC, data.lastSynced);
          if (onLoaded) onLoaded(withPdfKnowledge(data.items));
        }
      })
      .catch(() => {});
  } catch (e) {}
}

export function getSyncedKnowledgeItems(): KnowledgeItem[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (!raw) return null;
    return withPdfKnowledge(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getSyncedSheetUrl(): string {
  return localStorage.getItem(STORAGE_KEY_URL) || '';
}

export function getSyncedLastTime(): string | null {
  return localStorage.getItem(STORAGE_KEY_LAST_SYNC) || null;
}

export function clearSyncedKnowledgeItems(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_LAST_SYNC);
  } catch (e) {
    console.error('Failed to clear localStorage', e);
  }
  try {
    fetch('/api/sync/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: null, sheetUrl: '', lastSynced: null }),
    }).catch(() => {});
  } catch (e) {}
}

export function parseTSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => line.split('\t').map((c) => c.trim()));
}

export function generateTemplateCSV(): string {
  const headers = [
    'ID', 'Category', 'Audience', 'หัวข้อ / คำถาม', 'Keywords',
    'คำตอบสำหรับพนักงาน', 'ข้อความพร้อมส่งลูกค้า', 'รายละเอียด / เงื่อนไข', 'สิ่งที่ต้องทำต่อ',
    'Data Status', 'Status', 'AI Usable', 'Source', 'Last Updated', 'Start Date', 'End Date'
  ];
  const sampleRows = [
    ['BH-001', 'reservation', 'Customer', 'เวลาเช็คอิน', 'เช็คอิน, check in', 'ห้องพักเข้าได้บ่ายสอง', 'คุณลูกค้าสามารถเช็คอินได้ตั้งแต่ 14:00 น. เป็นต้นไปค่ะ', '', '', 'Confirmed', 'Published', 'Yes', 'Sheet1', '2023-10-01', '', '']
  ];
  return [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\r\n');
}
