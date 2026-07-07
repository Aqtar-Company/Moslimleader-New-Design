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

// PATCH /api/admin/orders/[id] — edit order items / amounts and optionally resend email
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePerm('orders.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const {
      items,        // { productId, productName, productImage, quantity, unitPrice, selectedModel }[]
      shippingCost,
      discount,
      notes,
      sendEmail,
    } = body as {
      items: { productId: string; productName: string; productImage?: string | null; quantity: number; unitPrice: number; selectedModel?: number | null }[];
      shippingCost: number;
      discount: number;
      notes?: string | null;
      sendEmail?: boolean;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'يجب أن يحتوي الطلب على منتج واحد على الأقل' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: true, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    if (['delivered', 'cancelled'].includes(existing.status)) {
      return NextResponse.json({ error: 'لا يمكن تعديل طلب مُسلَّم أو ملغي' }, { status: 400 });
    }

    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const total = Math.round((subtotal - (discount ?? 0) + (shippingCost ?? 0)) * 100) / 100;

    const { adjustStock, restoresFromItems, decrementsFromItems, InsufficientStockError } = await import('@/lib/stock');

    let updatedOrder;
    try {
      updatedOrder = await prisma.$transaction(async tx => {
        // 1. Restore stock from OLD items
        const oldItems = existing.items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          selectedModel: it.selectedModel ?? null,
        }));
        await adjustStock(restoresFromItems(oldItems), { reason: 'order_cancelled', orderId: id, adminId: auth.userId }, tx);

        // 2. Delete old items
        await tx.orderItem.deleteMany({ where: { orderId: id } });

        // 3. Create new items
        await tx.orderItem.createMany({
          data: items.map(it => ({
            orderId: id,
            productId: it.productId,
            productName: it.productName,
            productImage: it.productImage ?? null,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            selectedModel: it.selectedModel ?? null,
          })),
        });

        // 4. Decrement stock for NEW items
        const newItems = items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          selectedModel: it.selectedModel ?? null,
        }));
        await adjustStock(
          decrementsFromItems(newItems),
          { reason: 'order_uncancelled', orderId: id, adminId: auth.userId, enforceNonNegative: false },
          tx,
        );

        // 5. Update order totals
        return tx.order.update({
          where: { id },
          data: {
            total,
            shippingCost: shippingCost ?? 0,
            discount: discount ?? 0,
            notes: notes ?? existing.notes,
          },
          include: { items: true },
        });
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }

    await logActionSafe({
      actor: auth,
      action: 'order.edit',
      entity: 'Order',
      entityId: id,
      before: {
        total: existing.total,
        shippingCost: existing.shippingCost,
        discount: existing.discount,
        itemCount: existing.items.length,
      },
      after: { total, shippingCost, discount, itemCount: items.length },
    });

    // Optionally resend notification email with updated invoice
    if (sendEmail) {
      const { sendOrderEmails } = await import('@/lib/order-email');
      const addr = (existing.shippingAddress as Record<string, string>) ?? {};
      const customerName = `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim() || existing.user?.name || 'العميل';
      const customerPhone = addr.phone || existing.user?.phone || '';
      await sendOrderEmails({
        orderId: id,
        orderNumber: id.slice(-6).toUpperCase(),
        items: items.map(it => ({
          productName: it.productName,
          productImage: it.productImage ?? null,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          selectedModel: it.selectedModel ?? null,
        })),
        subtotal,
        discount: discount ?? 0,
        couponCode: existing.couponCode,
        shippingCost: shippingCost ?? 0,
        total,
        currency: existing.currency,
        paymentMethod: existing.paymentMethod,
        customerName,
        customerEmail: existing.user?.email ?? '',
        customerPhone,
        shippingAddress: {
          street: addr.street,
          building: addr.building,
          city: addr.city,
          region: addr.region,
          governorate: addr.governorate,
          country: addr.country,
        },
        notes: notes ?? existing.notes ?? undefined,
      }).catch(e => console.error('[order.edit email]', e));
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (err) {
    console.error('[admin order PATCH]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
