export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { cancelDelivery } from '@/lib/bosta';


// PUT /api/admin/orders/[id] — update order status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { id } = await params;
    const { status } = await req.json();

    const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'payment_failed'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'حالة غير صحيحة' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { shipment: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    let shipmentCancel: { ok: boolean; error?: string } | undefined;

    if (
      status === 'cancelled' &&
      existing.shipment?.bostaDeliveryId &&
      existing.shipment.status !== 'cancelled'
    ) {
      try {
        await cancelDelivery(existing.shipment.bostaDeliveryId);
        const prevHistory = Array.isArray(existing.shipment.history) ? (existing.shipment.history as unknown[]) : [];
        await prisma.shipment.update({
          where: { id: existing.shipment.id },
          data: {
            status: 'cancelled',
            history: [...prevHistory, { at: new Date().toISOString(), event: 'admin_cancelled' }] as unknown as object,
          },
        });
        shipmentCancel = { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'فشل إلغاء الشحنة من بوسطة';
        console.error('[admin order cancel → bosta]', err);
        shipmentCancel = { ok: false, error: message };
      }
    }

    return NextResponse.json({ order, shipmentCancel });
  } catch (err) {
    console.error('[admin order PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
