export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { sendOrderEmails } from '@/lib/order-email';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed } = checkRateLimit(`guest-order:${ip}`, 5, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'عدد الطلبات كبير جداً، حاول لاحقاً' }, { status: 429 });
    }

    const body = await req.json();
    const {
      orderNumber,
      items,
      total,
      shippingCost,
      discount,
      couponCode,
      paymentMethod,
      currency,
      shippingAddress,
      notes,
    } = body;

    const addr = (shippingAddress ?? {}) as Record<string, any>;

    const nameOk = (s: any) => typeof s === 'string' && s.trim().length >= 2 && /[؀-ۿa-zA-Z]{2,}/.test(s);
    const phoneOk = (s: any) => typeof s === 'string' && /^[+\d\s()-]{7,20}$/.test(s.trim());
    const streetOk = (s: any) => typeof s === 'string' && s.trim().length >= 4;

    if (!nameOk(addr.firstName) || !nameOk(addr.lastName)) {
      return NextResponse.json({ error: 'الاسم غير صحيح' }, { status: 400 });
    }
    if (!phoneOk(addr.phone)) {
      return NextResponse.json({ error: 'رقم الهاتف غير صحيح' }, { status: 400 });
    }
    if (!streetOk(addr.street)) {
      return NextResponse.json({ error: 'عنوان الشارع غير صحيح' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'لا توجد منتجات' }, { status: 400 });
    }
    if (!paymentMethod || !['cod', 'vodafone', 'instapay'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'طريقة دفع غير صحيحة' }, { status: 400 });
    }
    if (typeof total !== 'number' || total <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صحيح' }, { status: 400 });
    }

    const customerName = `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim() || 'ضيف';
    const subtotal = items.reduce(
      (s: number, it: { unitPrice: number; quantity: number }) => s + (it.unitPrice ?? 0) * (it.quantity ?? 1),
      0,
    );

    await sendOrderEmails({
      orderId: `GUEST-${Date.now()}`,
      orderNumber: orderNumber || String(Math.floor(100000 + Math.random() * 900000)),
      items: items.map((it: any) => ({
        productName: it.productName ?? 'منتج',
        productImage: it.productImage ?? null,
        quantity: it.quantity ?? 1,
        unitPrice: it.unitPrice ?? 0,
      })),
      subtotal,
      discount: discount ?? 0,
      couponCode: couponCode ?? null,
      shippingCost: shippingCost ?? 0,
      total,
      currency: currency ?? 'EGP',
      paymentMethod,
      customerName,
      customerEmail: '—',
      customerPhone: addr.phone ?? '—',
      shippingAddress: {
        street: addr.street,
        building: addr.building,
        city: addr.city,
        region: addr.region,
        governorate: addr.governorate,
        country: addr.country,
      },
      notes: notes ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[guest-notify]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
