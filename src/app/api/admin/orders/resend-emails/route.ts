export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOrderNotificationEmail } from '@/lib/order-email';
import { requireSuperAdmin } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

export async function POST() {
  try {
    const guard = await requireSuperAdmin();
    if ('response' in guard) return guard.response;
    const auth = guard.user;
    await logActionSafe({
      actor: auth,
      // Bulk recovery operation — log the trigger so anyone investigating
      // a wave of "duplicate order email" complaints can attribute it.
      action: 'order.update-status',
      entity: 'Order',
      metadata: { kind: 'resend-emails-bulk', startedAt: new Date().toISOString() },
    });

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      include: {
        items: true,
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let sent = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        const addr = (order.shippingAddress as Record<string, any>) || {};
        const subtotal = order.items.reduce(
          (s, it) => s + it.unitPrice * it.quantity,
          0,
        );

        await sendOrderNotificationEmail({
          orderId: order.id,
          orderNumber: order.id.slice(-6).toUpperCase(),
          items: order.items.map((it) => ({
            productName: it.productName,
            productImage: it.productImage,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
          subtotal,
          discount: order.discount ?? 0,
          couponCode: order.couponCode,
          shippingCost: order.shippingCost ?? 0,
          total: order.total,
          currency: order.currency,
          paymentMethod: order.paymentMethod,
          customerName:
            `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim() ||
            order.user?.name ||
            'عميل',
          customerEmail: order.user?.email || '—',
          customerPhone: addr.phone || order.user?.phone || '—',
          shippingAddress: {
            street: addr.street,
            building: addr.building,
            city: addr.city,
            region: addr.region,
            governorate: addr.governorate,
            country: addr.country,
          },
          notes: order.notes,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      total: orders.length,
      sent,
      failed,
    });
  } catch (err) {
    console.error('[resend-emails]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
