export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { generateInvoicePdf } from '@/lib/invoice-pdf';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { name: true, email: true } } },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (order.userId !== auth.userId && auth.role !== 'admin' && auth.role !== 'staff')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const subtotal = order.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const pdf = await generateInvoicePdf({
    orderId: order.id,
    orderNumber: `#${order.id.slice(-6).toUpperCase()}`,
    orderDate: order.createdAt.toLocaleString('ar-EG', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    items: order.items.map(it => ({
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })),
    subtotal,
    discount: order.discount,
    couponCode: order.couponCode,
    shippingCost: order.shippingCost,
    total: order.total,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    customerName: order.user?.name || 'ضيف',
    customerEmail: order.user?.email || '',
    customerPhone: (order.shippingAddress as unknown as { phone?: string })?.phone || '',
    shippingAddress: order.shippingAddress as unknown as {
      street?: string;
      building?: string;
      city?: string;
      region?: string;
      governorate?: string;
      country?: string;
    },
    notes: order.notes,
  });

  if (!pdf) return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${order.id.slice(-6)}.pdf"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
