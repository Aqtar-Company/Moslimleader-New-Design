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

// Walk the Bosta description for "name X count" repeating pairs.
// Bosta packs descriptions like:
//   "ابي يسأل X 1 كتاب فلسطين في عيون ابنائي X 4 كتاب البخاري X 1 ..."
// Each X (Latin or Arabic ×) separates a name from a count. The string
// can end with junk like "مجموع..." which we ignore by requiring the
// "next token after X" to parse as an integer.
export function parseItemsFromDescription(description: string | null): Array<{ name: string; quantity: number }> {
  if (!description) return [];
  const cleaned = description.replace(/×/g, 'X');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const items: Array<{ name: string; quantity: number }> = [];
  let currentName: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[Xx]$/.test(t)) {
      const next = tokens[i + 1];
      if (next && /^\d+$/.test(next)) {
        const name = currentName.join(' ').trim();
        const quantity = parseInt(next, 10);
        if (name && quantity > 0 && quantity <= 1000) {
          items.push({ name, quantity });
        }
        currentName = [];
        i += 1;
        continue;
      }
    }
    currentName.push(t);
  }
  return items;
}

// Generic words that show up in many product titles and would cause
// false matches if treated as content. "كتاب الفلان" vs "كتاب العلان"
// would otherwise score 0.5 just on the shared "كتاب" word.
const STOPWORDS = new Set([
  'كتاب', 'كتب', 'مجموعه', 'مجموعات', 'مسلسل', 'سلسله',
  'قصص', 'قصه', 'قصت', 'في', 'الي', 'من', 'علي', 'عن',
  'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'هو', 'هي',
]);

function meaningfulWords(s: string): string[] {
  return s.split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
}

export function matchProduct(rawName: string, products: ProductRef[]): { product: ProductRef; score: number } | null {
  const norm = normaliseArabic(rawName);
  if (!norm) return null;
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
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
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

  for (const v of validatedItems) {
    await tx.orderItem.create({ data: { orderId, ...v } });
  }
  return { ok: true, itemCount: validatedItems.length };
}
