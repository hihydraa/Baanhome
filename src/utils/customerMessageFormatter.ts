import { KnowledgeItem } from '../types';
import { isCompetitorKnowledge } from './knowledgeFilter';

export type ToneType = 'friendly' | 'formal' | 'concise';

/**
 * Checks if a message looks like raw database notes, internal staff summary,
 * contains pipe separators '|', or lacks customer hospitality etiquette.
 */
export function isRawOrUnreadyMessage(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  
  if (trimmed.startsWith('(สรุปข้อมูลสำหรับพนักงาน') || trimmed.startsWith('[สรุปข้อมูลสำหรับพนักงาน')) {
    return true;
  }
  if (trimmed.startsWith('(สรุป') || trimmed.startsWith('สรุปข้อมูล:')) {
    return true;
  }
  // Multiple pipe characters usually indicate database dump
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  if (pipeCount >= 2) {
    return true;
  }
  // Technical field labels dumped directly
  if (
    trimmed.includes('(Benchmark)') ||
    trimmed.includes('Capacity:') ||
    trimmed.includes('Facility:') ||
    trimmed.includes('Guardrail') ||
    trimmed.includes('ข้อมูลขัดแย้ง')
  ) {
    return true;
  }
  return false;
}

/**
 * Extract key-value segments from piped raw strings
 * e.g. "Capacity: VIP เล็ก ≤15 | อาหาร: มีสวนอาหาร | ราคา: 200/ชม."
 */
interface ParsedRawSegments {
  title?: string;
  capacity?: string;
  facilities?: string;
  rooms?: string;
  lodging?: string;
  food?: string;
  pricing?: string;
  location?: string;
  misc: string[];
}

function parsePipedRawText(rawText: string): ParsedRawSegments {
  // Remove wrapping parentheses like (สรุปข้อมูลสำหรับพนักงาน: ...)
  let clean = rawText
    .replace(/^\(?สรุปข้อมูลสำหรับพนักงาน:\s*/i, '')
    .replace(/\)$/, '')
    .trim();

  // Split by pipe
  const parts = clean.split('|').map((p) => p.trim()).filter(Boolean);
  
  const result: ParsedRawSegments = { misc: [] };

  for (const part of parts) {
    const lower = part.toLowerCase();
    
    // Ignore internal benchmark labels
    if (lower.includes('ประเภท: เรา') || lower.includes('(benchmark)') || lower.includes('benchmark')) {
      continue;
    }

    if (lower.startsWith('capacity:') || lower.includes('ความจุ:')) {
      result.capacity = part.replace(/^capacity:\s*/i, '').replace(/^ความจุ:\s*/i, '').trim();
    } else if (lower.startsWith('facility:') || lower.startsWith('facilities:') || lower.includes('สิ่งอำนวยความสะดวก:')) {
      result.facilities = part.replace(/^facilities?:\s*/i, '').replace(/^สิ่งอำนวยความสะดวก:\s*/i, '').trim();
    } else if (lower.includes('ห้องประชุม') || lower.includes('จัดเลี้ยง:')) {
      result.rooms = part.replace(/^ห้องประชุม\/จัดเลี้ยง:\s*/i, '').replace(/^ห้องประชุม:\s*/i, '').trim();
    } else if (lower.includes('ที่พัก:')) {
      result.lodging = part.replace(/^ที่พัก:\s*/i, '').trim();
    } else if (lower.includes('อาหาร:') || lower.includes('coffee break')) {
      result.food = part.replace(/^อาหาร:\s*/i, '').trim();
    } else if (lower.includes('ราคา') || lower.includes('ค่าบริการ')) {
      result.pricing = part.replace(/^ราคาออนไลน์:\s*/i, '').replace(/^ราคา:\s*/i, '').trim();
    } else if (lower.includes('ทำเล:') || lower.includes('ที่ตั้ง:')) {
      result.location = part.replace(/^ทำเล:\s*/i, '').replace(/^ที่ตั้ง:\s*/i, '').trim();
    } else {
      result.misc.push(part);
    }
  }

  return result;
}

/**
 * Intelligently generates a beautiful, customer-ready hospitality message
 * in 3 different communication styles (Friendly, Formal, Concise).
 */
export function generateHospitalityMessage(
  item: KnowledgeItem,
  tone: ToneType = 'friendly'
): string {
  // CRITICAL BUSINESS SAFETY: Competitor data is internal employee intelligence only!
  // Under NO circumstances should customer hospitality messages be generated for competitors.
  if (isCompetitorKnowledge(item)) {
    return '';
  }

  const isRaw = isRawOrUnreadyMessage(item.customerMessage);
  const baseMessage = item.customerMessage || '';

  // If the message is already polished and doesn't look like raw data,
  // we can use it directly or adapt it to requested tone.
  if (!isRaw && baseMessage.length > 20 && !baseMessage.includes('|')) {
    if (tone === 'friendly') {
      return baseMessage;
    }
    if (tone === 'formal') {
      return convertToFormalTone(baseMessage, item.title);
    }
    if (tone === 'concise') {
      return convertToConciseTone(baseMessage);
    }
  }

  // --- RAW DATA TRANSFORMATION ENGINE ---
  const rawSegments = parsePipedRawText(item.customerMessage || item.summary);

  // Friendly LINE OA Tone (Baan Home Signature Warm Concierge)
  if (tone === 'friendly') {
    const lines: string[] = [
      'สวัสดีค่ะคุณลูกค้า 🌿 ยินดีต้อนรับสู่บ้านโฮม สวนอาหารแอนด์รีสอร์ทค่ะ',
      '',
      `สำหรับข้อมูล **${item.title.replace(/\(เรา.*?\)/, '').trim()}** น้องโฮมขอแจ้งรายละเอียดดังนี้ค่ะ:`
    ];

    if (rawSegments.capacity) {
      const cleanCap = rawSegments.capacity
        .replace(/≤/g, 'ไม่เกิน ')
        .replace(/VIP เล็ก/g, 'ห้อง VIP เล็ก')
        .replace(/VIP ใหญ่/g, 'ห้อง VIP ใหญ่');
      lines.push(`🏛️ **ความจุผู้เข้าร่วม:** ${cleanCap} ท่าน`);
    }

    if (rawSegments.rooms) {
      const cleanRooms = rawSegments.rooms.replace(/^มี:\s*/, '');
      lines.push(`🪑 **พื้นที่ห้องประชุม & จัดเลี้ยง:** มีทั้ง ${cleanRooms}`);
    }

    if (rawSegments.facilities) {
      lines.push(`✨ **สิ่งอำนวยความสะดวก:** ${rawSegments.facilities}`);
    }

    if (rawSegments.pricing) {
      const cleanPrice = rawSegments.pricing
        .replace(/(\d+)\/ชม\./g, '$1 บาท/ชั่วโมง')
        .replace(/(\d+)\/วัน/g, '$1 บาท/วัน');
      lines.push(`💰 **อัตราค่าบริการ:** ${cleanPrice}`);
    }

    if (rawSegments.food) {
      lines.push(`🍽️ **บริการอาหาร & คอฟฟี่เบรค:** ${rawSegments.food}`);
    }

    if (rawSegments.lodging) {
      lines.push(`🏡 **ที่พักรองรับ:** ${rawSegments.lodging}`);
    }

    // Fallback if segments were not piped but had details
    if (!rawSegments.capacity && !rawSegments.pricing && item.detail && item.detail.length > 0) {
      item.detail.slice(0, 3).forEach((d) => {
        lines.push(`• ${d}`);
      });
    }

    // Extra misc lines
    if (rawSegments.misc.length > 0 && lines.length <= 4) {
      rawSegments.misc.slice(0, 2).forEach((m) => {
        lines.push(`• ${m}`);
      });
    }

    lines.push('');
    lines.push('คุณลูกค้ามีกำหนดการช่วงไหน หรือมีจำนวนผู้เข้าร่วมกี่ท่าน สามารถแจ้งน้องโฮมเพื่อจัดเตรียมพื้นที่และคำนวณข้อเสนอพิเศษให้ได้เลยนะคะ ยินดีดูแลค่ะ 😊');

    return lines.join('\n');
  }

  // Formal Tone (For Government, Corporate Letter, Formal Email)
  if (tone === 'formal') {
    const lines: string[] = [
      'เรียน ท่านผู้รับบริการ / ลูกค้าผู้มีอุปการคุณ',
      '',
      `บ้านโฮม สวนอาหารแอนด์รีสอร์ท อำเภอยางตลาด จังหวัดกาฬสินธุ์ ขอเรียนแจ้งรายละเอียดการให้บริการเกี่ยวกับ **${item.title}** ดังนี้:`,
      ''
    ];

    let counter = 1;
    if (rawSegments.capacity) {
      lines.push(`${counter++}. การรองรับผู้เข้าร่วม (Capacity): ${rawSegments.capacity.replace(/≤/g, 'สูงสุดไม่เกิน ')} ท่าน`);
    }
    if (rawSegments.rooms) {
      lines.push(`${counter++}. พื้นที่ห้องประชุมและสถานที่: ${rawSegments.rooms.replace(/^มี:\s*/, '')}`);
    }
    if (rawSegments.facilities) {
      lines.push(`${counter++}. โสตทัศนูปกรณ์และสิ่งอำนวยความสะดวก: ${rawSegments.facilities}`);
    }
    if (rawSegments.pricing) {
      lines.push(`${counter++}. อัตราค่าบริการ: ${rawSegments.pricing}`);
    }
    if (rawSegments.food) {
      lines.push(`${counter++}. การบริการอาหารและเครื่องดื่ม: ${rawSegments.food}`);
    }

    if (counter === 1 && item.detail && item.detail.length > 0) {
      item.detail.slice(0, 4).forEach((d) => {
        lines.push(`${counter++}. ${d}`);
      });
    }

    lines.push('');
    lines.push('หากหน่วยงานหรือองค์กรของท่านประสงค์ขอรับใบเสนอราคา หรือตรวจสอบความพร้อมของสถานที่ล่วงหน้า สามารถประสานงานได้ที่หมายเลขโทรศัพท์ 098-342-5545 หรือ LINE Official: @baanhome');
    lines.push('ขอขอบพระคุณที่ให้ความไว้วางใจในบริการของบ้านโฮม');

    return lines.join('\n');
  }

  // Concise Tone (Short and Direct for quick answers)
  const shortLines: string[] = [
    `ข้อมูล ${item.title}:`,
  ];
  if (rawSegments.capacity) shortLines.push(`• ความจุ: ${rawSegments.capacity}`);
  if (rawSegments.pricing) shortLines.push(`• ราคา: ${rawSegments.pricing}`);
  if (rawSegments.facilities) shortLines.push(`• อุปกรณ์: ${rawSegments.facilities}`);
  if (rawSegments.rooms) shortLines.push(`• ห้อง: ${rawSegments.rooms}`);
  
  if (shortLines.length === 1 && item.summary) {
    shortLines.push(`• ${item.summary}`);
  }

  shortLines.push('สอบถามจองห้องหรือรายละเอียดเพิ่มเติม: 098-342-5545 ค่ะ 🌿');
  return shortLines.join('\n');
}

/**
 * Converts an existing friendly message into a formal corporate style
 */
function convertToFormalTone(text: string, title: string): string {
  let cleaned = text
    .replace(/ค่ะ|คะ|นะคะ|จ้า|จ้ะ|นะค่ะ/g, '')
    .replace(/[🌿💚😊✨📍🍽️🎉]/g, '')
    .trim();

  return `เรียน ท่านผู้มีอุปการคุณ\n\nเกี่ยวกับ ${title} ขอเรียนแจ้งข้อมูลดังนี้:\n\n${cleaned}\n\nหากท่านต้องการข้อมูลเพิ่มเติมหรือเอกสารใบเสนอราคา สามารถติดต่อได้ที่ 098-342-5545\nขอขอบพระคุณเป็นอย่างยิ่งค่ะ`;
}

/**
 * Converts a message into a concise quick snippet
 */
function convertToConciseTone(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const keyLines = lines.slice(0, 4);
  return keyLines.join('\n') + '\n\nติดต่อเพิ่มเติม: 098-342-5545 หรือ LINE @baanhome ค่ะ';
}
