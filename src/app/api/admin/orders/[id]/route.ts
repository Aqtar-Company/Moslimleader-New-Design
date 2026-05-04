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
    const body = await req.json().catch(() => ({}));
    const status = body?.status as string | undefined;
    const force = body?.force === true;

    const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'payment_failed'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'حالة غير صحيحة' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { shipment: true, items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    let shipmentCancel: { ok: boolean; error?: string } | undefined;

    // Cancel-flow: try Bosta FIRST. Only flip the order to "cancelled" once we
    // know the package is actually halted (or the admin explicitly says
    // `force: true` after seeing the error). Otherwise we risk an
    // already-cancelled order whose package is still on its way to the
    // customer.
    if (
      status === 'cancelled' &&
      existing.shipment?.bostaDeliveryId &&
      existing.shipment.status !== 'cancelled'
    ) {
      try {
        await cancelDelivery(existing.shipment.bostaDeliveryId, existing.shipment.trackingNumber);
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
        if (!force) {
          // Refuse to cancel the order; admin can confirm-and-force in a
          // second click after reading the Bosta error.
          return NextResponse.json({
            error: `لم يتم إلغاء الأوردر — بوسطة رفضت الإلغاء: ${message}`,
            shipmentCancel: { ok: false, error: message, requiresForce: true },
          }, { status: 409 });
        }
        shipmentCancel = { ok: false, error: message };
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    // Stock side-effect: restore stock when an order moves into 'cancelled',
    // decrement again if it moves OUT of 'cancelled' back to a live status.
    try {
      const wasCancelled = existing.status === 'cancelled';
      const isCancelled = status === 'cancelled';
      if (wasCancelled !== isCancelled) {
        const { adjustStock, restoresFromItems, decrementsFromItems } = await import('@/lib/stock');
        const items = existing.items.map(it => ({ productId: it.productId, quantity: it.quantity }));
        if (isCancelled) await adjustStock(restoresFromItems(items));
        else await adjustStock(decrementsFromItems(items));
      }
    } catch (err) {
      console.error('[admin order PUT stock]', err);
    }

    return NextResponse.json({ order, shipmentCancel });
  } catch (err) {
    console.error('[admin order PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
