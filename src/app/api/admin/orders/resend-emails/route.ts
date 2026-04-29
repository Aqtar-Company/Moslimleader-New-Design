export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { sendOrderNotificationEmail } from '@/lib/order-email';

export async function POST() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const adminUser = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const orders = await prisma.order.findMany({
      include: {
        items: true,
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
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
