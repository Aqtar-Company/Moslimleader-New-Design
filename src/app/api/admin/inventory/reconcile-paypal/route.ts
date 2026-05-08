export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { adjustStock } from '@/lib/stock';

// Pre-fix PayPal orders (those captured before commit 1156eb6 wired
// adjustStock into /api/paypal/capture-order) created OrderItem rows
// without ever decrementing Product.stock. They still satisfy the
// "live, non-import" filter on the valuation page, so soldLive went
// up while stock didn't move.
//
// This endpoint finds every paid PayPal order that has at least one
// OrderItem WITHOUT a matching StockMovement(reason='order_created'),
// returning enough info for the UI to show the user what's about to be
// reconciled. POST does the same query then runs the decrements.

interface OrphanItem {
  orderId: string;
  orderCreatedAt: string;
  productId: string;
  productName: string;
  selectedModel: number | null;
  quantity: number;
}

async function findOrphans(): Promise<OrphanItem[]> {
  // Restrict to paid PayPal orders. We left-join StockMovement on
  // (orderId, productId) for reason='order_created' and pick rows where
  // the join didn't match. Multi-line orders are handled by the GROUP BY.
  const rows = await prisma.$queryRaw<Array<{
    orderId: string;
    createdAt: Date;
    productId: string;
    productName: string;
    selectedModel: number | null;
    quantity: number;
  }>>`
    SELECT o.id              AS orderId,
           o.createdAt        AS createdAt,
           oi.productId       AS productId,
           oi.productName     AS productName,
           oi.selectedModel   AS selectedModel,
           oi.quantity        AS quantity
    FROM \`Order\` o
    JOIN OrderItem oi ON oi.orderId = o.id
    LEFT JOIN StockMovement sm
      ON sm.orderId = o.id
     AND sm.productId = oi.productId
     AND sm.reason = 'order_created'
    WHERE o.paymentMethod = 'paypal'
      AND o.status = 'paid'
      AND sm.id IS NULL
    ORDER BY o.createdAt ASC
  `;

  return rows.map(r => ({
    orderId: r.orderId,
    orderCreatedAt: new Date(r.createdAt).toISOString(),
    productId: r.productId,
    productName: r.productName,
    selectedModel: r.selectedModel,
    quantity: Number(r.quantity),
  }));
}

export async function GET() {
  const guard = await requirePerm('inventory.write');
  if ('response' in guard) return guard.response;

  const items = await findOrphans();
  const totalUnits = items.reduce((s, it) => s + it.quantity, 0);
  const orderIds = Array.from(new Set(items.map(i => i.orderId)));
  return NextResponse.json({ items, totalUnits, orderCount: orderIds.length });
}

export async function POST() {
  const guard = await requirePerm('inventory.write');
  if ('response' in guard) return guard.response;

  const items = await findOrphans();
  if (items.length === 0) {
    return NextResponse.json({ ok: true, reconciled: 0, message: 'لا يوجد طلبات تحتاج تسوية' });
  }

  // Group decrements per order so each order's StockMovement rows carry
  // the right orderId for audit tracing. enforceNonNegative=false because
  // these are historical orders — stock may have already gone to zero by
  // hand and we still want the negative audit row instead of a hard fail.
  const byOrder = new Map<string, OrphanItem[]>();
  for (const it of items) {
    const arr = byOrder.get(it.orderId) ?? [];
    arr.push(it);
    byOrder.set(it.orderId, arr);
  }

  let reconciled = 0;
  for (const [orderId, lines] of byOrder.entries()) {
    try {
      await adjustStock(
        lines.map(l => ({
          productId: l.productId,
          delta: -l.quantity,
          selectedModel: l.selectedModel,
          note: `Backfill PayPal #${orderId.slice(0, 8)} (pre-fix)`,
        })),
        { reason: 'manual_adjustment', orderId, adminId: guard.user.userId, enforceNonNegative: false },
      );
      reconciled += lines.length;
    } catch (err) {
      console.error('[reconcile-paypal] failed for order', orderId, err);
      // Keep going so one bad order doesn't block the rest.
    }
  }

  await logActionSafe({
    actor: guard.user, action: 'inventory.adjust',
    entity: 'Order', entityId: 'paypal-backfill',
    metadata: { orphanLines: items.length, reconciled, orderCount: byOrder.size },
  });

  return NextResponse.json({ ok: true, reconciled, totalLines: items.length, orderCount: byOrder.size });
}
