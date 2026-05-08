export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { normaliseArabic } from '@/lib/arabic-normalize';

// Bosta historical imports were created without OrderItems (the import
// script never recorded which product shipped). That makes per-product
// "lifetime sold" silently undercount by however many Bosta-era units
// went out. This endpoint exposes those orphans + heuristic suggestions
// so an admin can backfill items and recover real numbers.

interface Suggestion {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  reason: 'name+price' | 'name' | 'price-match';
  confidence: number; // 0..1
}

interface OrphanRow {
  orderId: string;
  createdAt: string;
  customerName: string | null;
  trackingNumber: string | null;
  cod: number;
  description: string | null; // best-effort extract from rawPayload
  suggestions: Suggestion[];
}

// Walk the rawPayload (full Bosta API response) for any text field that
// could plausibly carry a product description. The list endpoint and
// the detail endpoint return slightly different shapes, so we try
// several known paths defensively.
function extractDescription(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const candidates: Array<unknown> = [
    (p.specs as Record<string, unknown> | undefined)?.packageDetails,
    p.specs,
    p.notes,
    p.description,
    p.businessReference, // sometimes used as a product hint
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

function scoreNameMatch(productName: string, haystack: string): number {
  if (!productName || !haystack) return 0;
  const pn = normaliseArabic(productName);
  const hs = normaliseArabic(haystack);
  if (!pn || !hs) return 0;
  // Direct substring is the strongest signal.
  if (hs.includes(pn)) return 1;
  // Otherwise count how many of the product-name words appear in the
  // haystack — works when the description has the words in a different
  // order or with extra noise around them.
  const pnWords = pn.split(' ').filter(w => w.length > 2);
  if (pnWords.length === 0) return 0;
  const hits = pnWords.filter(w => hs.includes(w)).length;
  return hits / pnWords.length;
}

export async function GET(req: NextRequest) {
  const guard = await requirePerm('valuation.read');
  if ('response' in guard) return guard.response;

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '200') || 200, 500);

  const [orphans, products] = await Promise.all([
    prisma.order.findMany({
      where: {
        paymentMethod: 'bosta-historical',
        items: { none: {} },
      },
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
    const cod = Number(o.shipment?.cod ?? o.total ?? 0);

    const suggestions: Suggestion[] = [];
    for (const p of products) {
      // 1) Name match: how many product-name words appear in description
      const nameScore = description ? scoreNameMatch(p.name, description) : 0;

      // 2) Price match: does COD divide cleanly into product price?
      // This catches "1 unit at 350 EGP", "2 units = 700", etc.
      let priceQty = 0;
      if (p.price > 0 && cod > 0) {
        const ratio = cod / p.price;
        const rounded = Math.round(ratio);
        if (rounded > 0 && rounded <= 20 && Math.abs(ratio - rounded) < 0.05) {
          priceQty = rounded;
        }
      }

      if (nameScore >= 0.5 && priceQty > 0) {
        suggestions.push({
          productId: p.id, productName: p.name, productPrice: p.price,
          quantity: priceQty, reason: 'name+price',
          confidence: Math.min(1, 0.5 + nameScore * 0.5),
        });
      } else if (nameScore >= 0.5) {
        suggestions.push({
          productId: p.id, productName: p.name, productPrice: p.price,
          quantity: 1, reason: 'name',
          confidence: nameScore * 0.7, // weaker without price corroboration
        });
      } else if (priceQty > 0 && priceQty === 1) {
        // Single-unit COD-match without name evidence is a weak signal
        // (many products may share a price). Surface it so admin can
        // pick, but with a low confidence.
        suggestions.push({
          productId: p.id, productName: p.name, productPrice: p.price,
          quantity: 1, reason: 'price-match',
          confidence: 0.3,
        });
      }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);

    return {
      orderId: o.id,
      createdAt: o.createdAt.toISOString(),
      customerName: o.user?.name ?? null,
      trackingNumber: o.shipment?.trackingNumber ?? null,
      cod,
      description,
      suggestions: suggestions.slice(0, 5),
    };
  });

  // Aggregate count of "high-confidence" suggestions so the UI can show
  // "X يمكن تأكيدها بضغطة واحدة".
  const highConfidenceCount = rows.filter(r => r.suggestions[0]?.confidence >= 0.8).length;

  return NextResponse.json({
    rows,
    totalOrphanCount,
    shown: rows.length,
    highConfidenceCount,
  });
}

// POST — bulk-create OrderItems from admin-confirmed assignments. The
// request body is an array of { orderId, productId, quantity, unitPrice }.
// We validate each entry against the actual order + product, then insert
// in a single transaction. No stock changes (these are historical sales,
// already consumed inventory).
export async function POST(req: NextRequest) {
  const guard = await requirePerm('valuation.write');
  if ('response' in guard) return guard.response;

  let body: { entries?: Array<{ orderId: string; productId: string; quantity: number; unitPrice?: number }> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: 'لا توجد إدخالات' }, { status: 400 });
  }

  const result = await prisma.$transaction(async tx => {
    const created: string[] = [];
    const errors: Array<{ orderId: string; error: string }> = [];

    for (const entry of body.entries!) {
      const orderId = String(entry.orderId ?? '');
      const productId = String(entry.productId ?? '');
      const quantity = Math.floor(Number(entry.quantity));
      if (!orderId || !productId || !Number.isFinite(quantity) || quantity <= 0) {
        errors.push({ orderId, error: 'بيانات غير صحيحة' });
        continue;
      }

      // Verify the order is still itemless (don't double-add).
      const existingItems = await tx.orderItem.count({ where: { orderId } });
      if (existingItems > 0) {
        errors.push({ orderId, error: 'الطلب أصبح يحتوي على عناصر بالفعل' });
        continue;
      }

      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, images: true },
      });
      if (!product) { errors.push({ orderId, error: 'المنتج غير موجود' }); continue; }

      const unitPrice = Number.isFinite(Number(entry.unitPrice)) && Number(entry.unitPrice) > 0
        ? Number(entry.unitPrice)
        : product.price;
      // Pull the first image URL from the JSON array; OrderItem.productImage
      // is a single nullable string, so we just denormalise the cover.
      const images = Array.isArray(product.images) ? (product.images as unknown as string[]) : [];
      const productImage = images[0] ?? null;

      await tx.orderItem.create({
        data: {
          orderId,
          productId: product.id,
          productName: product.name,
          productImage,
          quantity,
          unitPrice,
        },
      });

      created.push(orderId);
    }

    return { created, errors };
  }, { timeout: 30000 });

  await logActionSafe({
    actor: guard.user,
    action: 'inventory.adjust',
    entity: 'Order',
    entityId: 'bosta-backfill',
    metadata: { source: 'bosta-historical-backfill', createdCount: result.created.length, errorCount: result.errors.length },
  });

  return NextResponse.json({
    ok: true,
    created: result.created.length,
    skipped: result.errors.length,
    errors: result.errors,
  });
}
