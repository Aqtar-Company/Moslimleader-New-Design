export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cancelDelivery } from '@/lib/bosta';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';


// PUT /api/admin/orders/[id] — update order status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePerm('orders.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

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
        const attemptLog = (err as { attemptLog?: unknown }).attemptLog;
        console.error('[admin order cancel → bosta]', err);
        if (!force) {
          return NextResponse.json({
            error: `لم يتم إلغاء الأوردر — بوسطة رفضت الإلغاء: ${message}`,
            shipmentCancel: { ok: false, error: message, requiresForce: true },
            ...(attemptLog ? { debug: { attemptLog } } : {}),
          }, { status: 409 });
        }
        shipmentCancel = { ok: false, error: message };
      }
    }

    // Status flip + stock side-effect run in ONE transaction. If
    // un-cancelling fails because stock is now 0, the status flip is
    // rolled back and the admin sees a 409 with the Arabic message.
    const wasCancelled = existing.status === 'cancelled';
    const isCancelled = status === 'cancelled';
    const { adjustStock, restoresFromItems, decrementsFromItems, InsufficientStockError } = await import('@/lib/stock');
    let order;
    try {
      order = await prisma.$transaction(async tx => {
        const updated = await tx.order.update({ where: { id }, data: { status } });
        if (wasCancelled !== isCancelled) {
          const items = existing.items.map(it => ({ productId: it.productId, quantity: it.quantity, selectedModel: it.selectedModel ?? null }));
          if (isCancelled) {
            await adjustStock(restoresFromItems(items), { reason: 'order_cancelled', orderId: id, adminId: auth.userId }, tx);
          } else {
            await adjustStock(decrementsFromItems(items), { reason: 'order_uncancelled', orderId: id, adminId: auth.userId }, tx);
          }
        }
        return updated;
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }

    await logActionSafe({
      actor: auth,
      action: 'order.update-status',
      entity: 'Order',
      entityId: id,
      before: { status: existing.status },
      after: { status, shipmentCancel: shipmentCancel?.ok ?? null },
    });

    return NextResponse.json({ order, shipmentCancel });
  } catch (err) {
    console.error('[admin order PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
