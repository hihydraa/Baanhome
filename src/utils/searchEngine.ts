import { KnowledgeItem, KnowledgeCategory } from '../types';
import { isCustomerReady } from './knowledgeFilter';

export interface SearchResult {
  item: KnowledgeItem;
  score: number;
  matchedKeywords: string[];
}

export interface SearchOutcome {
  results: SearchResult[];
  intentData?: {
    intent: string;
    serviceType: string;
    hasCondition: boolean;
    needsClarification: boolean;
  };
}

const THAI_STOPWORDS = [
  'อยากทราบว่า', 'รบกวนสอบถาม', 'ขอสอบถาม', 'สอบถามหน่อย', 'สอบถาม',
  'ช่วยบอกหน่อย', 'อยากรู้ว่า', 'มีอะไรบ้าง', 'อะไรบ้าง', 'มีไหม', 'มีมั้ย',
  'ไหมครับ', 'ไหมคะ', 'ครับ', 'ค่ะ', 'คะ', 'หน่อย', 'บ้าง', 'เท่าไหร่',
  'กี่บาท', 'กี่โมง', 'เมื่อไหร่', 'ตอนไหน', 'ยังไง', 'ได้ไหม', 'ได้มั้ย',
  'หรือเปล่า', 'ตรงไหน', 'ที่ไหน', 'ราคา', 'มั้ย', 'ไหม', 'ขอ', 'มี'
];

// Safe Thai inclusion check that prevents false positive substring collisions.
// E.g., query "หมา" (dog) must NOT match "เป้าหมาย", "หมายเลข", "เสียหาย", "มอบหมาย", "กฎหมาย"
// where "หมา" is just part of the syllable "หมาย" (ห-ม-า-ย) or "หมาก", "หมาด".
export function thaiIncludes(text: string, sub: string): boolean {
  if (!text || !sub) return false;
  const t = text.toLowerCase();
  const s = sub.toLowerCase().trim();
  if (!s) return false;

  // Specific syllable boundary for "หมา" (dog)
  if (s === 'หมา') {
    return /หมา(?![ยกดง])/i.test(t);
  }

  // If query contains "หมา" without [ยกดง] (e.g. "นำหมามาได้ไหม", "หมาพักได้ไหม")
  if (s.includes('หมา') && !/หมา[ยกดง]/.test(s)) {
    const hasDogInText = /หมา(?![ยกดง])|สุนัข|สัตว์เลี้ยง|น้องหมา|pet/i.test(t);
    if (!hasDogInText && /หมา[ยกดง]/.test(t)) {
      return false;
    }
  }

  return t.includes(s);
}

// Hospitality Domain Intent & Keyword Expansions
interface IntentMapping {
  patterns: RegExp;
  boostKeywords: string[];
  targetCategories?: string[];
  priorityIds?: string[];
  priorityId?: string;
}

const INTENT_MAPPINGS: IntentMapping[] = [
  {
    patterns: /เช็คอิน|เช็กอิน|check\s*in|เข้าพัก|ออกกี่โมง|เช็คเอาท์|เช็กเอาท์|check\s*out|late\s*check|early\s*check|กี่โมงเข้าได้|เวลาเช็ค/i,
    boostKeywords: ['check-in', 'เช็คอิน', 'เช็คเอาท์', 'เวลาเข้าพัก', '14:00', '12:00'],
    priorityIds: ['KH-032', 'BH-018', 'BH-019', 'kb-checkin-checkout'],
    targetCategories: ['resort-knowledge', 'reservation']
  },
  {
    patterns: /โอนเงิน|มัดจำ|เลขบัญชี|ชำระเงิน|จ่ายเงิน|ธนาคาร|บัญชี|สแกน|qr|กสิกร|กรุงไทย|สลิป/i,
    boostKeywords: ['มัดจำ', 'โอนเงิน', 'ชำระเงิน', 'เลขบัญชี', 'ธนาคาร', 'การเงิน', '429-0-87779-7', 'สลิป'],
    priorityIds: ['KH-100', 'BH-033', 'BH-032', 'kb-payment-bank'],
    targetCategories: ['reservation', 'quotation-policy']
  },
  {
    patterns: /แผนที่|ที่ตั้ง|พิกัด|อยู่ที่ไหน|ทางไป|นำทาง|google\s*maps?|location|gps|ตำบล|อำเภอ|ยางตลาด|กาฬสินธุ์/i,
    boostKeywords: ['แผนที่', 'ที่อยู่', 'พิกัด', 'google maps', 'ที่ตั้ง', 'การเดินทาง', 'ยางตลาด', 'คลองขาม'],
    priorityIds: ['KH-007', 'BH-002', 'kb-location-map'],
    targetCategories: ['business-profile', 'resort-knowledge']
  },
  {
    patterns: /สัตว์เลี้ยง|หมา(?![ยกดง])|แมว|สุนัข|pet|น้องหมา|น้องแมว|สัตว์/i,
    boostKeywords: ['สัตว์เลี้ยง', 'pet-friendly', 'สุนัข', 'แมว', 'สัตว์', 'หมา', '200'],
    priorityIds: ['KH-035', 'BH-020', 'kb-pet-policy'],
    targetCategories: ['resort-knowledge', 'reservation']
  },
  {
    patterns: /พูลวิลล่า|pool\s*villa|สระว่ายน้ำส่วนตัว|วิลล่า|ปาร์ตี้/i,
    boostKeywords: ['พูลวิลล่า', 'pool villa', 'สระว่ายน้ำส่วนตัว', 'เตาปิ้งย่าง', 'คาราโอเกะ'],
    priorityIds: ['KH-040', 'KH-041', 'KH-042', 'BH-021', 'BH-022', 'BH-023'],
    targetCategories: ['pool-villa', 'pool-villa-knowledge']
  },
  {
    patterns: /กฎสระ|สระว่ายน้ำ|เวลาเปิดสระ|สระลึก|ชุดว่ายน้ำ|เล่นน้ำ/i,
    boostKeywords: ['สระว่ายน้ำ', 'กฎสระ', 'ชุดว่ายน้ำ', 'สระลึก', 'เวลาเปิดสระ'],
    priorityIds: ['KH-047', 'BH-025', 'BH-026'],
    targetCategories: ['pool-villa', 'resort-knowledge']
  },
  {
    patterns: /อาหารเช้า|breakfast|บุฟเฟต์|บุฟเฟ่ต์|ไข่กระทะ|กาแฟเช้า/i,
    boostKeywords: ['อาหารเช้า', 'breakfast', 'บุฟเฟ่ต์', '07:00'],
    priorityIds: ['KH-033', 'BH-022']
  },
  {
    patterns: /เตา|ปิ้งย่าง|บาร์บีคิว|bbq|ถ่าน/i,
    boostKeywords: ['เตาปิ้งย่าง', 'บาร์บีคิว', 'bbq'],
    priorityIds: ['KH-050', 'BH-028']
  },
  {
    patterns: /เสียง|คาราโอเกะ|ลำโพง|เครื่องเสียง|เสียงดัง/i,
    boostKeywords: ['เสียง', 'การใช้เสียง', 'คาราโอเกะ', '22:00'],
    priorityIds: ['KH-051', 'BH-027']
  },
  {
    patterns: /ประชุม|สัมมนา|จัดเลี้ยง|ห้องประชุม|mini\s*mice|mice|คอฟฟี่เบรค|vip\s*ใหญ่|vip\s*เล็ก/i,
    boostKeywords: ['ประชุม', 'สัมมนา', 'จัดเลี้ยง', 'mini mice', 'ห้องประชุม', 'vip ใหญ่', 'vip เล็ก'],
    priorityIds: ['KH-012', 'KH-013', 'KH-145', 'KH-147', 'BH-008', 'BH-009', 'BH-010', 'BH-011', 'BH-027', 'BH-028'],
    targetCategories: ['mini-mice']
  },
  {
    patterns: /เด็ก|เตียงเสริม|พักเกิน|จำนวนคน|พักได้กี่คน|เสริมเตียง/i,
    boostKeywords: ['เด็ก', 'เตียงเสริม', 'ผู้เข้าพัก', 'จำนวนคน', '300'],
    priorityIds: ['KH-034', 'BH-016', 'BH-035', 'BH-036'],
    targetCategories: ['reservation', 'resort-knowledge']
  },
  {
    patterns: /สวนอาหาร|ร้านอาหาร|เมนู|เปิดกี่โมง|ปิดกี่โมง|ลานบน|ลานน้ำตก/i,
    boostKeywords: ['สวนอาหาร', 'เมนู', 'ลานบน', 'ลานน้ำตก', 'เวลาเปิด'],
    priorityIds: ['KH-010', 'KH-011', 'BH-004', 'BH-005', 'BH-006', 'BH-007', 'BH-012'],
    targetCategories: ['restaurant']
  },
  {
    patterns: /รีสอร์ท|ห้องพัก|deluxe|standard|เตียงเดี่ยว|เตียงคู่/i,
    boostKeywords: ['รีสอร์ท', 'ห้องพัก', 'deluxe', 'เตียงเดี่ยว'],
    priorityIds: ['KH-030', 'KH-031', 'BH-013', 'BH-014', 'BH-015', 'BH-017'],
    targetCategories: ['resort', 'resort-knowledge']
  },
  {
    patterns: /ยกเลิก|refund|คืนเงิน|เลื่อนวัน|เปลี่ยนวัน/i,
    boostKeywords: ['ยกเลิก', 'refund', 'คืนเงิน', 'เลื่อนวัน', 'มัดจำ'],
    priorityIds: ['KH-102', 'BH-034'],
    targetCategories: ['reservation', 'quotation-policy']
  },
  {
    patterns: /เบอร์โทร|โทร|ติดต่อ|line\s*oa|facebook|เบอร์|ช่องทางติดต่อ/i,
    boostKeywords: ['ติดต่อ', 'โทร', '098-342-5545', 'line', 'line oa', '@baanhome', 'facebook'],
    priorityIds: ['KH-006', 'BH-003'],
    targetCategories: ['business-profile', 'customer-service']
  }
];

export function executeInstantSearch(
  query: string,
  items: KnowledgeItem[]
): SearchOutcome {
  const cleanQuery = query.trim().toLowerCase();
  
  if (!cleanQuery) return { results: [] };

  // Strip Thai stopwords from query
  let strippedQuery = cleanQuery;
  for (const sw of THAI_STOPWORDS) {
    strippedQuery = strippedQuery.split(sw).join(' ');
  }
  strippedQuery = strippedQuery.replace(/\s+/g, ' ').trim();

  // Normalize check-in terms
  const normalizedQuery = cleanQuery.replace(/เช็คอิน|เช็กอิน|check in|checkin/g, 'check-in');

  let results: SearchResult[] = [];
  
  for (const item of items) {
    let score = 0;
    const matchedKeywords: string[] = [];

    const itemId = (item.id || '').toLowerCase();
    const titleStr = (item.title || '').toLowerCase();
    const keywordsStr = (item.keywords || []).join(' ').toLowerCase();
    const detailStr = (item.detail || []).join(' ').toLowerCase();
    const summaryStr = (item.summary || '').toLowerCase();
    const customerMsgStr = (item.customerMessage || '').toLowerCase();
    const categoryStr = (item.category || '').toLowerCase();

    // 1. Direct ID match (Highest priority)
    if (cleanQuery === itemId || cleanQuery.includes(itemId)) {
      score += 500;
      matchedKeywords.push('id_exact');
    }

    // 2. Exact Title match or Substring (Using safe Thai syllable matching)
    if (thaiIncludes(titleStr, cleanQuery) || thaiIncludes(cleanQuery, titleStr)) {
      score += 160;
      matchedKeywords.push('title_exact');
    } else if (strippedQuery && thaiIncludes(titleStr, strippedQuery)) {
      score += 95;
      matchedKeywords.push('title_stripped');
    }

    // 3. Keywords matching (Using safe Thai syllable matching)
    item.keywords?.forEach(kw => {
      const kwLower = kw.toLowerCase();
      if (thaiIncludes(cleanQuery, kwLower)) {
        score += kwLower.length >= 4 ? 50 : 30;
        matchedKeywords.push(kw);
      } else if (thaiIncludes(kwLower, cleanQuery) && cleanQuery.length >= 2) {
        score += 35;
        matchedKeywords.push(kw);
      } else if (strippedQuery && (thaiIncludes(kwLower, strippedQuery) || thaiIncludes(strippedQuery, kwLower))) {
        score += 25;
        matchedKeywords.push(kw);
      }
    });

    // 4. Intent mappings & Domain rules
    for (const intent of INTENT_MAPPINGS) {
      if (intent.patterns.test(cleanQuery)) {
        // Boost priority items if defined (high priority match)
        const allPriorityIds = [
          ...(intent.priorityIds || []),
          ...(intent.priorityId ? [intent.priorityId] : [])
        ];
        if (allPriorityIds.some(pid => item.id.toLowerCase().includes(pid.toLowerCase()))) {
          score += 250;
          matchedKeywords.push('intent_priority');
        }

        // Boost category
        if (intent.targetCategories && intent.targetCategories.includes(item.category)) {
          score += 40;
        }

        // Boost keywords
        for (const bk of intent.boostKeywords) {
          if (thaiIncludes(titleStr, bk) || (item.keywords && item.keywords.some(k => thaiIncludes(k, bk)))) {
            score += 30;
            matchedKeywords.push(bk);
          }
        }
      }
    }

    // 5. Content relevance (Customer message, summary, details)
    if (thaiIncludes(customerMsgStr, cleanQuery)) {
      score += 25;
      matchedKeywords.push('customer_message');
    } else if (strippedQuery && thaiIncludes(customerMsgStr, strippedQuery)) {
      score += 15;
    }

    if (thaiIncludes(summaryStr, cleanQuery)) {
      score += 15;
    }

    if (thaiIncludes(detailStr, cleanQuery)) {
      score += 10;
    }

    // 6. Bonus for Customer-Ready Items with Customer Messages (Crucial for Q&A!)
    if (isCustomerReady(item)) {
      score += 80;
    }
    if (item.customerMessage && item.customerMessage.trim().length > 0) {
      score += 40;
    } else {
      // Items without customer message receive a penalty in Q&A search
      score -= 60;
    }

    if (score > 0) {
      results.push({ item, score, matchedKeywords: [...new Set(matchedKeywords)] });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, 15)
  };
}

export async function executeSearch(
  query: string,
  items: KnowledgeItem[],
  useAI: boolean = false
): Promise<SearchOutcome> {
  return executeInstantSearch(query, items);
}

export async function askGemini(
  query: string, 
  results: SearchResult[],
  signal?: AbortSignal
): Promise<{ answer: string; referenceIds: string[] }> {
  // If request was already aborted, exit immediately
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Filter Customer Ready items (Limit to top 3-4 most relevant items for speed and accuracy)
  const customerReadyItems = results
    .filter(r => isCustomerReady(r.item))
    .slice(0, 4)
    .map(r => r.item);

  // No early return when nothing matches: the server decides (DeepSeek can still
  // answer within the Baanhome role scope; otherwise it falls back to a "please verify" reply).
  // Client-side timeout so the UI never spins forever; caller's abort still wins
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 35000);
  const onCallerAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onCallerAbort);

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, contextItems: customerReadyItems }),
      signal: timeoutController.signal
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server responded with status ${res.status}`);
    }

    const data = await res.json();
    if (data?.isFallback) console.warn('Ask AI fallback:', data.fallbackReason);
    
    // Clean any stray reference lines from answer for pristine customer messaging
    const rawAnswer = String(data.answer || '');
    const cleanAnswer = rawAnswer
      .replace(/(?:\r?\n)*\s*(?:\(|\[)?\s*(?:อ้างอิงจากรหัสข้อมูล|อ้างอิงจากข้อมูล|อ้างอิงรหัสข้อมูล|อ้างอิงรหัส|อ้างอิงข้อมูล|อ้างอิง|Reference|Ref\.?)\s*[:：]?\s*[\w\-\s,]+(?:\)|\])?/gi, '')
      .replace(/(?:\r?\n)+\s*(?:\(|\[)?\s*(?:BH|KH|KB|RM|REST|MICE|PROMO)-\d+(?:\)|\])?\s*$/gi, '')
      .trim();

    // Use backend-provided referenceIds, or fallback to top customer ready items
    const referenceIds = Array.isArray(data.referenceIds) && data.referenceIds.length > 0
      ? data.referenceIds
      : customerReadyItems.map(i => i.id);
    
    return { answer: cleanAnswer, referenceIds };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw error; // Let caller know it was deliberately cancelled
      return {
        answer: "น้องโฮม AI ตอบช้ากว่าปกติค่ะ ลองกด \"เรียบเรียงใหม่\" อีกครั้ง หรือดูข้อมูลจากผลการค้นหาด้านล่างนะคะ 💚",
        referenceIds: []
      };
    }
    console.warn("Ask Gemini Notice:", error?.message || error);
    return {
      answer: "ระบบผู้ช่วย AI ขัดข้องชั่วคราวค่ะ โปรดดูข้อมูลจากการค้นหาด้านล่างนะคะ 💚",
      referenceIds: []
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
