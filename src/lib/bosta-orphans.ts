import { Prisma } from '@prisma/client';
import { normaliseArabic } from './arabic-normalize';

// Shared helpers for the Bosta-orphan recovery tooling. Lives here
// (not in the route file) because Next.js route modules can only
// export route handlers — exporting helpers from a route.ts triggers
// a TS validation error.

export interface SuggestedItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  unitPrice: number;
  matchScore: number;
  parsedName: string;
}

export interface OrphanRow {
  orderId: string;
  createdAt: string;
  customerName: string | null;
  trackingNumber: string | null;
  cod: number;
  orderTotal: number;
  description: string | null;
  parsedItems: Array<{ name: string; quantity: number }>;
  suggestedItems: SuggestedItem[];
  suggestedSum: number;
  paymentNote: string;
  confidence: number;
  priceDriftPct: number | null;
}

export interface ProductRef { id: string; name: string; price: number }

// Free-text notes that show up in the description field but aren't
// product references — recipient instructions, fragility warnings,
// closing times, etc. We bail on them so the single-line fallback
// doesn't try to "match" them.
const NOTE_HINTS = [
  'اسم الل', 'اسم اللى', 'اسم اللي',
  'موعد', 'الشركه',
  'قابل للكسر', 'قابل للكسرر',
  'برجاء', 'يرجي', 'يرجى', 'يرجا',
  'ملاحظ', 'ملحوظ',
  'العنوان', 'تليفون', 'موبايل', 'محمول',
  'استلام افاد', 'بحث بعنوان', 'دكتور بجامعه',
  'التشجير', 'افاده',
  'مندوب الشحن', 'محتاج شركه الشحن', 'محتاجه شركه الشحن', 'يكلمها قبل', 'يكلمه قبل',
];

// ٠-٩ Arabic-Indic digits → 0-9 ASCII so the rest of the parser
// (which uses \d, only ASCII) sees them as numbers.
function asciifyDigits(s: string): string {
  return s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function looksLikeNote(s: string): boolean {
  return NOTE_HINTS.some(h => s.includes(h));
}

// Number-word → digit lookup for "نسختين" / "ثلاث نسخ" / etc. that
// occasionally appear instead of a digit.
const NUM_WORDS: Record<string, number> = {
  'نسخه': 1, 'نسخة': 1, 'واحد': 1, 'واحده': 1, 'واحدة': 1,
  'نسختين': 2, 'نسختان': 2, 'اثنين': 2, 'اتنين': 2, 'اثنان': 2,
  'ثلاث': 3, 'ثلاثه': 3, 'ثلاثة': 3,
  'اربع': 4, 'اربعه': 4, 'اربعة': 4, 'أربع': 4, 'أربعة': 4,
  'خمس': 5, 'خمسه': 5, 'خمسة': 5,
  'ست': 6, 'سته': 6, 'ستة': 6,
  'سبع': 7, 'سبعه': 7, 'سبعة': 7,
  'ثمان': 8, 'ثمانية': 8, 'تمن': 8,
  'تسع': 9, 'تسعه': 9, 'تسعة': 9,
  'عشر': 10, 'عشره': 10, 'عشرة': 10,
};

// Strip trailing price/note tail like " - 100 ج بدل 120 ج..." or
// " - ملاحظة ممكن حضرتك..." that often follows a product name in
// free-text descriptions. We split on the first occurrence of any of:
//   " - "        the most common product/price separator
//   "ملاحظة"     start of a customer note
//   "اهداء"      a personalised dedication request
//   " ١٠٠ ج"     a price tag in EGP (digit-then-جنيه)
function stripTail(name: string): string {
  let n = name;
  // Cut at the first " - " or " – " separator (price/comment).
  n = n.split(/\s+[-–]\s+/)[0];
  // Cut at any of the note-prefix words.
  n = n.split(/\s+(?:ملاحظ[هة]|اهداء|إهداء|ممكن\s+حضرتك|يرجى|برجاء)/)[0];
  // Cut just before a price tag (digit followed by " ج" / "ج.م").
  n = n.split(/\s+\d+\s*(?:ج\.م|ج\b|جم\b|جنيه)/)[0];
  // Trailing parenthesised aside.
  n = n.replace(/\s*\(.*?\)\s*$/, '');
  // Asterisks / bullet punctuation.
  n = n.replace(/[*•]+/g, '');
  return n.trim();
}

// Bosta descriptions arrive in many formats. Try them in cascade:
//   1. "Name:<n>  - quantity:<q>"  — website checkout export
//   2. "<name> X <q>"              — legacy manual import
//   3. line-by-line "[عدد] N <name>" / "نسختين <name>" /
//      free-text "<name>, <name>, …"
//   4. single bare product name
// First format that yields ≥1 item wins.
export function parseItemsFromDescription(description: string | null): Array<{ name: string; quantity: number }> {
  if (!description) return [];
  const desc = asciifyDigits(description);
  const items: Array<{ name: string; quantity: number }> = [];

  // Format 1: Name:... - quantity:N
  const nameQtyRe = /Name:\s*([^\n]+?)\s*-\s*quantity:\s*(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = nameQtyRe.exec(desc)) !== null) {
    const name = m[1].trim();
    const quantity = parseInt(m[2], 10);
    if (name && quantity > 0 && quantity <= 1000) items.push({ name, quantity });
  }
  if (items.length > 0) return items;

  // Format 2: "<name> X <q>" pairs.
  const cleaned = desc.replace(/×/g, 'X');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  let currentName: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[Xx]$/.test(t)) {
      const next = tokens[i + 1];
      if (next && /^\d+$/.test(next)) {
        const name = currentName.join(' ').trim();
        const quantity = parseInt(next, 10);
        if (name && quantity > 0 && quantity <= 1000) items.push({ name, quantity });
        currentName = [];
        i += 1;
        continue;
      }
    }
    currentName.push(t);
  }
  if (items.length > 0) return items;

  // Format 3: split on // / \n / , and parse each segment.
  const segments = desc.split(/\/{1,3}|\n|,/).map(s => s.trim()).filter(Boolean);
  for (let raw of segments) {
    raw = raw.replace(/^[*•\s]+/, '').trim();
    if (!raw) continue;

    // "عدد N من? <name>" or bare-leading "N <name>" — allow Nمن
    // attached without space ("عدد 2من X").
    let mm = raw.match(/^(?:عدد\s*)?(\d+)\s*(?:من\s*)?(.+)$/);
    if (mm) {
      const q = parseInt(mm[1], 10);
      const name = stripTail(mm[2]);
      if (q > 0 && q <= 1000 && name.length > 0 && !looksLikeNote(name)) {
        items.push({ name, quantity: q });
        continue;
      }
    }
    // Number-word + name: "نسختين من X" / "ثلاث نسخ X"
    const wordMatch = raw.match(/^([^\s]+)\s+(?:نسخ[ه|ة]?\s+)?(?:من\s+)?(.+)$/);
    if (wordMatch && NUM_WORDS[wordMatch[1]]) {
      const q = NUM_WORDS[wordMatch[1]];
      const name = stripTail(wordMatch[2]);
      if (name.length > 0 && !looksLikeNote(name)) {
        items.push({ name, quantity: q });
        continue;
      }
    }
    // Plain product name (qty 1) — strip price/note tail FIRST so a
    // "X - ملاحظة Y" line still yields the X part as a product.
    const cleanName = stripTail(raw);
    if (cleanName.length > 0 && cleanName.length <= 120 && !looksLikeNote(cleanName)) {
      items.push({ name: cleanName, quantity: 1 });
    }
  }
  if (items.length > 0) return items;

  // Format 4: single bare product name as last resort.
  let trimmed = desc.trim().replace(/\s+/g, ' ');
  trimmed = trimmed.replace(/^(اوردر|أوردر|طلب)\s+/i, '');
  let quantity = 1;
  const leadDigit = trimmed.match(/^(\d+)\s*(.+)$/);
  if (leadDigit) {
    const q = parseInt(leadDigit[1], 10);
    if (q > 0 && q <= 1000) { quantity = q; trimmed = leadDigit[2].trim(); }
  }
  if (trimmed.length > 0 && trimmed.length <= 120 && !looksLikeNote(trimmed)) {
    return [{ name: trimmed, quantity }];
  }
  return [];
}

// Generic words that show up in many product titles and would cause
// false matches if treated as content. "كتاب الفلان" vs "كتاب العلان"
// would otherwise score 0.5 just on the shared "كتاب" word.
const STOPWORDS = new Set([
  'كتاب', 'كتب', 'مجموعه', 'مجموعات', 'مسلسل', 'سلسله',
  'قصص', 'قصه', 'قصت', 'في', 'الي', 'من', 'علي', 'عن',
  'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'هو', 'هي',
]);

// Items that occasionally show up in Bosta descriptions but are NOT
// products we sell (returned customer goods, accidental entries,
// etc.). Skip them outright instead of letting the fuzzy matcher
// hallucinate an attribution.
const IGNORE_PATTERNS: RegExp[] = [
  /(^|\s)عبايه(\s|$)/,
  /(^|\s)جهاز(\s|$)/,
  /(^|\s)منظم(\s|$)/,
  /(^|\s)بوستر(\s|$)/,           // posters not in catalogue
  /(^|\s)سيليكون(\s|$)/,
  /(^|\s)مذيب(\s|$)/,
  /(^|\s)رساله\s+ماجيستير/,
  /(^|\s)افاد(ه|ة)(\s|$)/,       // research papers / acceptance letters
  /(^|\s)بحث(\s|$)/,
  /(^|\s)تشجير/,                 // genealogy diagrams
  /(^|\s)كاراتيه/,               // karate bag — not in catalogue
  /(^|\s)جدول\s+هديه/,           // free schedules / gifts
  /^هديه$/,                      // bare "هديه" line (not "X هديه")
  /(^|\s)notes(\s|$)/i,          // "5 notes/" placeholder
  /(^|\s)عرض\s+اركان/,           // bundle wording, not a product
  /(^|\s)رقم\s+(اخر|لخر|آخر)/,   // "رقم تليفون آخر" — note, not a product
  /(^|\s)شهاده(\s|$)/,           // certificate of appreciation — gift line
  /(^|\s)ورق(\s|$)/,             // bare "ورق" — too generic
  /^[0-9"\s]+$/,                 // bare digit / quote / whitespace
  /(^|\s)المشرق(\s|$)|ماليزيا/,  // wholesale customer (handled separately)
];

function isIgnored(parsedNorm: string): boolean {
  return IGNORE_PATTERNS.some(re => re.test(parsedNorm));
}

// Manual aliases for cases the fuzzy matcher genuinely can't reach
// from the Bosta description text alone. The right-hand side is a
// product-name fragment we look up in the actual catalogue (so we
// don't hard-code product IDs that change between environments).
//
// Each entry is checked against the NORMALISED parsed name. The
// FIRST matching entry wins — order them most-specific first.
//
// NOTE: regex \b doesn't work on Arabic in JS (it's ASCII-only),
// so word boundaries use explicit (^|\s)…(\s|$) groups.
// Each entry's `targets` is an ORDERED list of product-name fragments.
// We pick the first one that actually exists in the catalogue (so we
// ride through renames without breaking — e.g. "مفكرة أولاد" today,
// "مفكرة أطفال" if the catalogue ever reverts).
const ALIASES: Array<{ pattern: RegExp; targets: string[]; reason: string }> = [
  // SPECIFIC product variants come FIRST so they win over the broad
  // mug pattern at the bottom.

  // مفكرة — owner has separate "مفكرة أولاد" / "مفكرة بنات" today
  // ("مفكرة أطفال" was an older single name — keep as fallback).
  // Use .* between مفكره and the gender word so "مفكره اطفال بنت"
  // routes to بنات (not أولاد by fallback chain).
  { pattern: /مفكره.*(بنت|بنات)/, targets: ['مفكرة بنات', 'مفكرة أطفال'], reason: 'planner-girls' },
  { pattern: /مفكره.*(ولد|اولاد)/, targets: ['مفكرة أولاد', 'مفكرة اولاد', 'مفكرة أطفال'], reason: 'planner-boys' },
  { pattern: /مفكره.*(كبار|نساء|كبير|رجال|ام\b|ام\s)/, targets: ['مفكرة كبار'], reason: 'planner-adults' },
  { pattern: /^مفكره(\s|$)/, targets: ['مفكرة أطفال', 'مفكرة أولاد'], reason: 'planner-default' },
  // ماسك / حامل المصحف
  // ماسك — "ماسك مصحف"، "ماسك اخضر"، "ماسك بينك"، "حامل المصحف"
  { pattern: /(^|\s)ماسك(\s|$)|حامل\s+المصحف/, targets: ['حامل المصحف'], reason: 'mushaf-holder' },
  // لعبة الحج والصلاة — also matches the bare "حج وصلاه" / "حج وصلاه خشب" variant.
  { pattern: /لعبه.*(الحج|حج).*(الصلاه|صلاه)|لعبه.*(الصلاه|صلاه).*(الحج|حج)|^\s*(الحج|حج)\s+(و)?(الصلاه|صلاه)|^\s*(الصلاه|صلاه)\s+(و)?(الحج|حج)/, targets: ['لعبة الصلاة وقصة الحج'], reason: 'hajj-prayer-game' },
  { pattern: /لعبه\s+يوم\s+الصائم|لعبه\s+الصائم|^\s*(الصيام|صيام|الصائم|صائم)\s*$/, targets: ['لعبة يوم الصائم'], reason: 'fasting-game' },
  // شنطة
  { pattern: /شنطه\s+(بناتي|بنات|اولاد|ولاد|اولادي|حضانه|اطفال|ولد|بنت)/, targets: ['شنطة مسلم ليدر'], reason: 'bag' },
  // وسام
  { pattern: /وسام/, targets: ['وسام القائد'], reason: 'medal' },
  // Variants on existing books — short forms that show up in
  // free-text descriptions. Keyword anywhere in the parsed name.
  { pattern: /(^|\s)(رواي(ه|ة)\s+)?(البخاري|البحاري|بخاري|بحاري)(\s|$)|كوكب\s+المريخ/, targets: ['البخاري على كوكب المريخ'], reason: 'bukhari' },
  { pattern: /(^|\s)امهات\s+العظماء(\s|$)|رسائل\s+امهات/, targets: ['رسائل أمهات العظماء'], reason: 'mothers-of-greats' },
  { pattern: /(^|\s)فلسطين(\s|$)|عيون\s+ابنائي|عيون\s+أبنائي|كتاب\s+الاسره/, targets: ['فلسطين في عيون ابنائي'], reason: 'palestine' },
  { pattern: /(^|\s)القاده(\s|$)|قاده\s+الاسلام|قاده\s+و?ائمه\s+المسلمين|كروت\s+القاده/, targets: ['إعداد القادة'], reason: 'leaders' },
  { pattern: /(^|\s)(الواح|اللواح)(\s|$)|جزء\s+عم/, targets: ['ألواح'], reason: 'looh' },
  { pattern: /(^|\s)استاذي(\s|$)|الي\s+ابني|إلى\s+ابني/, targets: ['إلى ابني واستاذي الشاب', 'كتاب إلى ابني'], reason: 'to-my-son' },
  { pattern: /(^|\s)قصص\s+الصلاه(\s|$)|قصه\s+الصلاه/, targets: ['قصة الصلاة'], reason: 'prayer-stories' },
  { pattern: /(^|\s)فقيه(\s|$)|بلاد\s+العجائب/, targets: ['فقيه في بلاد العجائب'], reason: 'faqih' },
  { pattern: /(^|\s)تكوين(\s+اولاد|\s+بنات)?(\s|$)/, targets: ['تكوين'], reason: 'tkween' },
  { pattern: /(^|\s)دبوس(\s|$)/, targets: ['دبوس'], reason: 'pin' },
  { pattern: /(^|\s)البر(\s|$)|مسلسل\s+البر/, targets: ['مسلسل البر'], reason: 'birr' },

  // Personalized mugs go LAST so the specific-product aliases above
  // (which sometimes also contain "ولد", "بنت", etc.) win first.
  // Accept "مج" preceded by start/space OR a digit ("1مج بنت" with no
  // space — Bosta descriptions occasionally use this form).
  { pattern: /(?:^|\s|\d)مج(?:ات)?(?:\s|$)/, targets: ['مجات'], reason: 'mug-prefix' },
];

// For the mug entry we resolve to ولاد / بنات / نساء by scanning
// gender hints in the parsed text.
function refineMugTarget(parsedNorm: string): string {
  if (/(^|\s)ولد(\s|$)/.test(parsedNorm)) return 'مجات ولاد';
  if (/(منتقبه|نساء|سيده|سيدات)/.test(parsedNorm)) return 'مجات نساء';
  return 'مجات بنات';
}

function tryAlias(parsedNorm: string, products: ProductRef[]): { product: ProductRef; score: number } | null {
  for (const a of ALIASES) {
    if (!a.pattern.test(parsedNorm)) continue;
    // Mug entry: refine the target by gender hints in the parsed text.
    const targets = a.reason === 'mug-prefix' ? [refineMugTarget(parsedNorm)] : a.targets;
    for (const target of targets) {
      const targetNorm = normaliseArabic(target);
      const hit = products.find(p => {
        const pn = normaliseArabic(p.name);
        return pn === targetNorm || pn.includes(targetNorm) || targetNorm.includes(pn);
      });
      if (hit) return { product: hit, score: 0.95 };
    }
  }
  return null;
}

function meaningfulWords(s: string): string[] {
  return s.split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
}

export function matchProduct(rawName: string, products: ProductRef[]): { product: ProductRef; score: number } | null {
  const norm = normaliseArabic(rawName);
  if (!norm) return null;

  // Drop items we know aren't products (عبايه, جهاز, …) — better to
  // leave the orphan unattributed than to mis-bind it to something
  // unrelated.
  if (isIgnored(norm)) return null;

  // Aliases run BEFORE the fuzzy logic — if an explicit pattern fires,
  // trust it over whatever the substring/word-overlap heuristic would
  // pick (which would otherwise mis-route to a closer-looking title).
  const alias = tryAlias(norm, products);
  if (alias) return alias;
  // Strip common Bosta-description prefixes ("كتاب", "مجموعه",
  // "مسلسل", "سلسله") that products themselves usually don't carry,
  // so "كتاب البخاري" can match a product literally called "البخاري"
  // and "مجموعه قصص الصلاه" can match "قصه الصلاه" via the singular
  // form. We try BOTH the original and the stripped form and keep the
  // best score.
  const stripped = norm
    .replace(/^(كتاب|كتب|مجموعه|مجموعات|مسلسل|سلسله|قصص|قصه|قصت)\s+/g, '')
    .replace(/\s+(كتاب|كتب)$/g, '');
  const variants = stripped !== norm ? [norm, stripped] : [norm];

  let best: { product: ProductRef; score: number } | null = null;
  for (const p of products) {
    const pn = normaliseArabic(p.name);
    if (!pn) continue;
    const pnStripped = pn.replace(/^(كتاب|كتب|مجموعه|مسلسل|سلسله)\s+/g, '');
    const productVariants = pnStripped !== pn ? [pn, pnStripped] : [pn];

    for (const v of variants) {
      for (const pv of productVariants) {
        let score = 0;
        if (pv === v) score = 1;
        else if (pv.includes(v)) score = 0.92;
        else if (v.includes(pv)) score = 0.88;
        else {
          // Word-overlap, both directions: % of product words present in
          // parsed AND % of parsed words present in product. Take max so
          // a parsed name with extra junk words still scores well.
          // Stopwords are excluded so "كتاب" alone doesn't link two
          // unrelated titles.
          const pnWords = meaningfulWords(pv);
          const vWords = meaningfulWords(v);
          if (pnWords.length === 0 || vWords.length === 0) continue;
          const pnHits = pnWords.filter(w => v.includes(w)).length;
          const vHits = vWords.filter(w => pv.includes(w)).length;
          score = Math.max(pnHits / pnWords.length, vHits / vWords.length);
        }
        if (best === null || score > best.score) best = { product: p, score };
      }
    }
  }
  // Lowered threshold from 0.5 to 0.4 — owner explicitly wants
  // approximate sales figures, not pixel-perfect attribution. With
  // only ~23 products in the catalogue, a 0.4 threshold rarely picks
  // the wrong one and the bulk-match audit log makes mistakes
  // recoverable.
  return best && best.score >= 0.4 ? best : null;
}

// Price-reconciliation score: how well does the suggested basket sum
// match the recorded order/COD total. Three compounding sources of
// drift in historical Bosta data force a wide tolerance:
//   1. Catalogue prices today are roughly ~10% higher than at import
//      time (NOT a fixed percentage — varies by SKU and era).
//   2. The COD value sometimes bundled the Bosta shipping fee and
//      sometimes didn't (customer occasionally paid the courier
//      separately, occasionally paid the whole thing in advance).
//   3. Bosta shipping fees themselves changed over time, so even when
//      the fee IS bundled in COD it isn't a fixed amount we can
//      subtract.
// Strict ±5% rejected legitimate matches. Widened to ±15% full credit
// with a linear fall-off out to ±30% — see plan addendum 25.
const PRICE_DRIFT_FULL_CREDIT = 0.15;
const PRICE_DRIFT_ZERO_CREDIT = 0.30;

export function priceReconciliationScore(suggestedSum: number, anchor: number): number {
  if (anchor <= 0 || suggestedSum <= 0) return 0;
  const drift = Math.abs(suggestedSum - anchor) / anchor;
  if (drift <= PRICE_DRIFT_FULL_CREDIT) return 1;
  if (drift >= PRICE_DRIFT_ZERO_CREDIT) return 0;
  return 1 - (drift - PRICE_DRIFT_FULL_CREDIT) / (PRICE_DRIFT_ZERO_CREDIT - PRICE_DRIFT_FULL_CREDIT);
}

export function extractDescription(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    (p.specs as Record<string, unknown> | undefined)?.packageDetails,
    p.specs,
    p.notes,
    p.description,
    p.businessReference,
    // Fallback: Bosta's structured `productInfo` field. Sometimes it's
    // an array of {productName, quantity} objects, sometimes a string.
    p.productInfo,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (Array.isArray(c) && c.length > 0) {
      // Render structured productInfo into the parser's
      // "Name:X - quantity:N" format so format 1 picks it up.
      const lines: string[] = [];
      for (const it of c) {
        if (it && typeof it === 'object') {
          const r = it as Record<string, unknown>;
          const name = r.productName ?? r.name ?? r.title;
          const qty = r.quantity ?? r.qty ?? r.count ?? 1;
          if (typeof name === 'string' && name.trim()) {
            lines.push(`Name:${name.trim()} - quantity:${Number(qty) || 1}`);
          }
        }
      }
      if (lines.length > 0) return lines.join('\n');
    }
    if (c && typeof c === 'object') {
      const obj = c as Record<string, unknown>;
      const text = obj.description ?? obj.notes ?? obj.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
  }
  return null;
}

export function buildOrphanRow(
  o: {
    id: string;
    total: Prisma.Decimal | number | null;
    createdAt: Date;
    user: { name: string | null } | null;
    shipment: { trackingNumber: string | null; rawPayload: unknown; cod: Prisma.Decimal | number | null } | null;
  },
  products: ProductRef[],
): OrphanRow {
  const description = extractDescription(o.shipment?.rawPayload);
  const cod = Number(o.shipment?.cod ?? 0);
  const orderTotal = Number(o.total ?? 0);

  const parsedItems = parseItemsFromDescription(description);
  const suggestedItems: SuggestedItem[] = [];
  let totalMatchScore = 0;
  for (const it of parsedItems) {
    const m = matchProduct(it.name, products);
    if (m) {
      suggestedItems.push({
        productId: m.product.id,
        productName: m.product.name,
        productPrice: m.product.price,
        quantity: it.quantity,
        unitPrice: m.product.price,
        matchScore: m.score,
        parsedName: it.name,
      });
      totalMatchScore += m.score;
    }
  }

  const suggestedSum = suggestedItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const anchor = orderTotal > 0 ? orderTotal : cod;

  let confidence = 0;
  // Confidence formula: blend of name-matching coverage and price-
  // reconciliation. The name component (totalMatchScore / parsedItems)
  // already encodes BOTH coverage and per-item quality — items that
  // didn't match contribute 0 to the sum, so a 3-of-4 match with
  // perfect quality on the 3 scores 0.75, not punished further.
  if (parsedItems.length > 0) {
    const nameScore = totalMatchScore / parsedItems.length;
    if (anchor > 0 && suggestedSum > 0) {
      confidence = nameScore * 0.6 + priceReconciliationScore(suggestedSum, anchor) * 0.4;
    } else {
      // No price anchor (InstaPay/free-ship) — trust names only, lightly
      // capped so we don't auto-confirm without ANY corroborating signal.
      confidence = nameScore * 0.85;
    }
  }
  confidence = Math.min(1, confidence);

  const priceDriftPct = anchor > 0 && suggestedSum > 0
    ? Math.round(((suggestedSum - anchor) / anchor) * 1000) / 10
    : null;

  const paymentNote = cod > 0
    ? `استلام بالـ COD: ${Math.round(cod).toLocaleString('en-US')} ج.م`
    : orderTotal > 0
      ? `سعر مسجَّل بدون COD: ${Math.round(orderTotal).toLocaleString('en-US')} ج.م (إنستاباي/دفع مسبق على الأرجح)`
      : 'مفيش سعر مسجَّل (شحنة مجانية أو هدية)';

  return {
    orderId: o.id,
    createdAt: o.createdAt.toISOString(),
    customerName: o.user?.name ?? null,
    trackingNumber: o.shipment?.trackingNumber ?? null,
    cod, orderTotal,
    description, parsedItems, suggestedItems,
    suggestedSum: Math.round(suggestedSum * 100) / 100,
    paymentNote,
    confidence,
    priceDriftPct,
  };
}

export async function applyBackfillEntry(
  tx: Prisma.TransactionClient,
  entry: { orderId: string; items: Array<{ productId: string; quantity: number; unitPrice?: number }> },
): Promise<{ ok: true; itemCount: number } | { ok: false; error: string }> {
  const orderId = String(entry.orderId ?? '');
  if (!orderId || !Array.isArray(entry.items) || entry.items.length === 0) {
    return { ok: false, error: 'بيانات غير صحيحة' };
  }

  const existingItems = await tx.orderItem.count({ where: { orderId } });
  if (existingItems > 0) {
    return { ok: false, error: 'الطلب أصبح يحتوي على عناصر بالفعل' };
  }

  const validatedItems: Array<{ productId: string; productName: string; productImage: string | null; quantity: number; unitPrice: number }> = [];
  for (const it of entry.items) {
    const productId = String(it.productId ?? '');
    const quantity = Math.floor(Number(it.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: 'كمية أو منتج غير صحيح في أحد العناصر' };
    }
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, images: true },
    });
    if (!product) {
      return { ok: false, error: `المنتج ${productId} غير موجود` };
    }
    const requestedPrice = Number(it.unitPrice);
    const unitPrice = Number.isFinite(requestedPrice) && requestedPrice >= 0
      ? requestedPrice
      : product.price;
    const images = Array.isArray(product.images) ? (product.images as unknown as string[]) : [];
    const productImage = images[0] ?? null;
    validatedItems.push({ productId: product.id, productName: product.name, productImage, quantity, unitPrice });
  }

  try {
    for (const v of validatedItems) {
      await tx.orderItem.create({ data: { orderId, ...v } });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'خطأ أثناء حفظ عناصر الطلب';
    return { ok: false, error: `فشل إنشاء عنصر للطلب ${orderId}: ${msg}` };
  }
  return { ok: true, itemCount: validatedItems.length };
}
