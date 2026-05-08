export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { normaliseArabic } from '@/lib/arabic-normalize';

// Bosta historical imports were created without OrderItems — this tool
// recovers them. Real orders contain MULTIPLE products per delivery, so
// the suggestion engine parses the Bosta description for "name × qty"
// pairs, fuzzy-matches each name to a Product, and proposes a complete
// multi-item bundle. The admin reviews + adjusts + saves.

interface SuggestedItem {
  productId: string;
  productName: string;
  productPrice: number;     // current catalog price (anchor for suggested unitPrice)
  quantity: number;         // from the parsed description
  unitPrice: number;        // suggested = current Product.price; admin can override for old prices
  matchScore: number;       // 0..1 — how confident the name-match is
  parsedName: string;       // the raw token from description, for transparency
}

interface OrphanRow {
  orderId: string;
  createdAt: string;
  customerName: string | null;
  trackingNumber: string | null;
  cod: number;              // amount actually collected on delivery (0 = InstaPay/paid-prior)
  orderTotal: number;       // Order.total — the recorded price; anchor for reconciliation
  description: string | null;
  parsedItems: Array<{ name: string; quantity: number }>; // pre-match parser output
  suggestedItems: SuggestedItem[];
  suggestedSum: number;     // sum of (qty × suggested unitPrice) — for the COD-match check
  paymentNote: string;      // human hint: "تم الاستلام بـ COD" / "InstaPay أو دفع مسبق"
  confidence: number;       // 0..1 — overall: combines name-match + price-reconciliation
}

// Walk the Bosta description for "name X count" repeating pairs.
// Bosta packs descriptions like:
//   "ابي يسأل X 1 كتاب فلسطين في عيون ابنائي X 4 كتاب البخاري X 1 ..."
// Each X (Latin or Arabic ×) separates a name from a count. The string
// can end with junk like "مجموع..." which we ignore by requiring the
// "next token after X" to parse as an integer.
function parseItemsFromDescription(description: string | null): Array<{ name: string; quantity: number }> {
  if (!description) return [];
  // Normalize the multiplication marker to plain X so the tokenizer is simple.
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
        i += 1; // consume the count token
        continue;
      }
    }
    currentName.push(t);
  }
  return items;
}

interface ProductRef { id: string; name: string; price: number }

function matchProduct(rawName: string, products: ProductRef[]): { product: ProductRef; score: number } | null {
  const norm = normaliseArabic(rawName);
  if (!norm) return null;
  let best: { product: ProductRef; score: number } | null = null;
  for (const p of products) {
    const pn = normaliseArabic(p.name);
    if (!pn) continue;
    let score = 0;
    if (pn === norm) score = 1;
    else if (pn.includes(norm)) score = 0.92;
    else if (norm.includes(pn)) score = 0.88;
    else {
      const pnWords = pn.split(' ').filter(w => w.length > 2);
      if (pnWords.length === 0) continue;
      const hits = pnWords.filter(w => norm.includes(w)).length;
      score = pnWords.length > 0 ? hits / pnWords.length : 0;
    }
    if (best === null || score > best.score) best = { product: p, score };
  }
  return best && best.score >= 0.5 ? best : null;
}

// Pull the description from rawPayload; Bosta's list and detail endpoints
// nest it slightly differently, so we try a few known paths.
function extractDescription(payload: unknown): string | null {
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

export async function GET(req: NextRequest) {
  const guard = await requirePerm('valuation.read');
  if ('response' in guard) return guard.response;

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '200') || 200, 500);

  const [orphans, products] = await Promise.all([
    prisma.order.findMany({
      where: { paymentMethod: 'bosta-historical', items: { none: {} } },
      select: {
        id: true, total: true, createdAt: true,
        user: { select: { name: true } },
        shipment: { select: { trackingNumber: true, rawPayload: true, cod: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.product.findMany({
      select: { id: true, name: true, price: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalOrphanCount = await prisma.order.count({
    where: { paymentMethod: 'bosta-historical', items: { none: {} } },
  });

  const rows: OrphanRow[] = orphans.map(o => {
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

    // Confidence formula: blend of name-matching quality and
    // price-reconciliation. If parse failed (no items), confidence = 0.
    // If items matched and sum ≈ order total (within 5%), confidence is
    // boosted. If no recorded total (InstaPay), we lean on match score
    // alone.
    let confidence = 0;
    if (parsedItems.length > 0 && suggestedItems.length === parsedItems.length) {
      const avgMatch = totalMatchScore / suggestedItems.length;
      confidence = avgMatch * 0.6;
      const anchor = orderTotal > 0 ? orderTotal : cod;
      if (anchor > 0 && suggestedSum > 0) {
        const ratio = Math.min(suggestedSum, anchor) / Math.max(suggestedSum, anchor);
        confidence += ratio * 0.4;
      } else if (anchor === 0) {
        // No price anchor (InstaPay/free-ship): trust the names only.
        confidence += 0.2;
      }
    } else if (suggestedItems.length > 0) {
      // Partial match: some items recognized, others not. Half credit.
      confidence = (totalMatchScore / parsedItems.length) * 0.4;
    }
    confidence = Math.min(1, confidence);

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
    };
  });

  const highConfidenceCount = rows.filter(r => r.confidence >= 0.8).length;

  return NextResponse.json({
    rows,
    totalOrphanCount,
    shown: rows.length,
    highConfidenceCount,
  });
}

// POST — accept multi-item assignments per order. Body:
//   { entries: [{ orderId, items: [{ productId, quantity, unitPrice }, ...] }] }
// We do NOT update Order.total — the recorded value is treated as truth.
// If the unit prices the admin entered don't sum to Order.total, that's
// FINE — the admin saw the discrepancy in the UI and made a call.
// (Common reason: prices changed since the order shipped.)
export async function POST(req: NextRequest) {
  const guard = await requirePerm('valuation.write');
  if ('response' in guard) return guard.response;

  let body: { entries?: Array<{ orderId: string; items: Array<{ productId: string; quantity: number; unitPrice?: number }> }> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: 'لا توجد إدخالات' }, { status: 400 });
  }

  const result = await prisma.$transaction(async tx => {
    const created: string[] = [];
    let totalItemsCreated = 0;
    const errors: Array<{ orderId: string; error: string }> = [];

    for (const entry of body.entries!) {
      const orderId = String(entry.orderId ?? '');
      if (!orderId || !Array.isArray(entry.items) || entry.items.length === 0) {
        errors.push({ orderId, error: 'بيانات غير صحيحة' });
        continue;
      }

      // Skip orders that already have items (idempotent re-runs).
      const existingItems = await tx.orderItem.count({ where: { orderId } });
      if (existingItems > 0) {
        errors.push({ orderId, error: 'الطلب أصبح يحتوي على عناصر بالفعل' });
        continue;
      }

      // Validate every requested item before creating any of them, so
      // a single bad row doesn't leave a partially-itemized order.
      const validatedItems: Array<{ productId: string; productName: string; productImage: string | null; quantity: number; unitPrice: number }> = [];
      let invalid = false;
      for (const it of entry.items) {
        const productId = String(it.productId ?? '');
        const quantity = Math.floor(Number(it.quantity));
        if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
          errors.push({ orderId, error: `كمية أو منتج غير صحيح في أحد العناصر` });
          invalid = true;
          break;
        }
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, name: true, price: true, images: true },
        });
        if (!product) {
          errors.push({ orderId, error: `المنتج ${productId} غير موجود` });
          invalid = true;
          break;
        }
        const requestedPrice = Number(it.unitPrice);
        const unitPrice = Number.isFinite(requestedPrice) && requestedPrice >= 0
          ? requestedPrice
          : product.price;
        const images = Array.isArray(product.images) ? (product.images as unknown as string[]) : [];
        const productImage = images[0] ?? null;
        validatedItems.push({ productId: product.id, productName: product.name, productImage, quantity, unitPrice });
      }
      if (invalid) continue;

      for (const v of validatedItems) {
        await tx.orderItem.create({ data: { orderId, ...v } });
        totalItemsCreated++;
      }
      created.push(orderId);
    }

    return { created, errors, totalItemsCreated };
  }, { timeout: 60000 });

  await logActionSafe({
    actor: guard.user,
    action: 'inventory.adjust',
    entity: 'Order',
    entityId: 'bosta-backfill',
    metadata: {
      source: 'bosta-historical-backfill',
      ordersBackfilled: result.created.length,
      itemsCreated: result.totalItemsCreated,
      errorCount: result.errors.length,
    },
  });

  return NextResponse.json({
    ok: true,
    created: result.created.length,
    itemsCreated: result.totalItemsCreated,
    skipped: result.errors.length,
    errors: result.errors,
  });
}
