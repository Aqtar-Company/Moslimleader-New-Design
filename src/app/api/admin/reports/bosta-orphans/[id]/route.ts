export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// DELETE /api/admin/reports/bosta-orphans/[id]
// Permanently deletes a single bosta-historical orphan order.
// Only operates on orders that have no items (confirmed orphan) and
// are of type 'bosta-historical' to prevent accidental real-order deletion.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePerm(['inventory.write', 'orders.write']);
  if ('response' in guard) return guard.response;

  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, total: true, paymentMethod: true,
      _count: { select: { items: true } },
      shipment: { select: { trackingNumber: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  }
  if (order.paymentMethod !== 'bosta-historical') {
    return NextResponse.json({ error: 'لا يمكن حذف هذا الطلب من هنا' }, { status: 400 });
  }
  if (order._count.items > 0) {
    return NextResponse.json({ error: 'الطلب يحتوي على عناصر — استخدم صفحة الطلبات للحذف' }, { status: 400 });
  }

  await logActionSafe({
    actor: guard.user,
    action: 'order.delete',
    entity: 'Order',
    entityId: orderId,
    metadata: {
      reason: 'dismissed from bosta-orphans page',
      total: Number(order.total ?? 0),
      trackingNumber: order.shipment?.trackingNumber ?? null,
    },
  });

  await prisma.order.delete({ where: { id: orderId } });

  return NextResponse.json({ ok: true });
}
