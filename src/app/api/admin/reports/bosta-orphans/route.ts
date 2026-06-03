export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { applyBackfillEntry, buildOrphanRow } from '@/lib/bosta-orphans';

// Bosta historical imports were created without OrderItems — this tool
// recovers them. Real orders contain MULTIPLE products per delivery, so
// the suggestion engine parses the Bosta description for "name × qty"
// pairs, fuzzy-matches each name to a Product, and proposes a complete
// multi-item bundle. The admin reviews + adjusts + saves.
//
// Shared scoring + persistence helpers live in `src/lib/bosta-orphans.ts`
// so the bulk-match endpoint can reuse them.

export async function GET(req: NextRequest) {
  const guard = await requirePerm('inventory.read');
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

  const rows = orphans.map(o => buildOrphanRow(o, products));
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
export async function POST(req: NextRequest) {
  const guard = await requirePerm('inventory.write');
  if ('response' in guard) return guard.response;

  let body: { entries?: Array<{ orderId: string; items: Array<{ productId: string; quantity: number; unitPrice?: number }> }> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: 'لا توجد إدخالات' }, { status: 400 });
  }

  let result: { created: string[]; errors: Array<{ orderId: string; error: string }>; totalItemsCreated: number };
  try {
    result = await prisma.$transaction(async tx => {
      const created: string[] = [];
      let totalItemsCreated = 0;
      const errors: Array<{ orderId: string; error: string }> = [];

      for (const entry of body.entries!) {
        const r = await applyBackfillEntry(tx, entry);
        if (r.ok) {
          created.push(entry.orderId);
          totalItemsCreated += r.itemCount;
        } else {
          errors.push({ orderId: entry.orderId, error: r.error });
        }
      }

      return { created, errors, totalItemsCreated };
    }, { timeout: 60000 });
  } catch (err) {
    console.error('[bosta-orphans POST] transaction error:', err);
    const message = err instanceof Error ? err.message : 'خطأ غير معروف في قاعدة البيانات';
    return NextResponse.json({ error: message }, { status: 500 });
  }

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
