export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { capturePayPalOrder } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { sendOrderEmails } from '@/lib/order-email';
import { COUNTRY_CURRENCIES } from '@/lib/geo-pricing';

const EGP_TO_USD = 1 / 50;

function toUsd(amount: number, currencyEn: string): number {
  if (!amount || amount <= 0) return 0;
  if (currencyEn === 'USD') return amount;
  if (currencyEn === 'EGP') return amount * EGP_TO_USD;
  const entry = Object.values(COUNTRY_CURRENCIES).find(c => c.currencyEn === currencyEn);
  if (entry && entry.usdRate > 0) return amount / entry.usdRate;
  return amount;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const body = await req.json();
    const paypalOrderId = String(body?.paypalOrderId || '');
    const items = body?.items;
    const shippingAddress = body?.shippingAddress;

    if (!paypalOrderId || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { paypalOrderId } });
    if (existing) {
      return NextResponse.json({ orderId: existing.id, status: existing.status });
    }

    // Server-side address validation (anti-garbage data)
    const addr = shippingAddress as Record<string, any>;
    const nameOk = (s: any) => typeof s === 'string' && s.trim().length >= 2 && /[\u0600-\u06FFa-zA-Z]{2,}/.test(s);
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

    let totalUsd = 0;
    const resolvedItems: any[] = [];
    for (const item of items) {
      const qty = Number(item?.quantity);
      if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
        return NextResponse.json({ error: 'كمية غير صحيحة' }, { status: 400 });
      }

      let dbProduct = await prisma.product.findFirst({
        where: { OR: [{ id: String(item.productId) }, { slug: String(item.productId) }] },
      });

      if (!dbProduct) {
        const sp = staticProducts.find(p => p.id === item.productId || p.slug === item.productId);
        if (sp) {
          dbProduct = await prisma.product.upsert({
            where: { slug: sp.slug },
            create: {
              id: sp.id, slug: sp.slug, name: sp.name, nameEn: sp.nameEn,
              shortDescription: sp.shortDescription, shortDescriptionEn: sp.shortDescriptionEn,
              description: sp.description, descriptionEn: sp.descriptionEn,
              price: sp.price, category: sp.category, subcategory: sp.subcategory,
              variants: (sp.variants ?? []) as object[], tags: sp.tags as string[],
              images: sp.images as string[], inStock: sp.inStock,
              featured: sp.featured ?? false, videos: sp.videos ?? [],
              weight: sp.weight, source: 'static',
            },
            update: {},
          });
        }
      }

      if (!dbProduct) {
        return NextResponse.json({ error: 'منتج غير موجود' }, { status: 400 });
      }

      const unitUsd = dbProduct.priceUsd && dbProduct.priceUsd > 0
        ? Number(dbProduct.priceUsd)
        : Number(dbProduct.price) * EGP_TO_USD;

      totalUsd += unitUsd * qty;

      resolvedItems.push({
        productId: dbProduct.id,
        quantity: qty,
        selectedModel: item.selectedModel ?? null,
        unitPrice: unitUsd,
        productName: dbProduct.name,
        productImage: (dbProduct.images as any)?.[0] ?? null,
      });
    }

    const rawShipping = Math.max(0, Number(body?.shippingUsd) || 0);
    const rawDiscount = Math.max(0, Number(body?.discountUsd) || 0);
    const shippingCurrencyEn = String(body?.shippingCurrency || 'USD').toUpperCase();
    const discountCurrencyEn = String(body?.discountCurrency || 'USD').toUpperCase();
    const shippingUsd = Math.min(500, toUsd(rawShipping, shippingCurrencyEn));
    const discountUsd = Math.min(totalUsd + shippingUsd, toUsd(rawDiscount, discountCurrencyEn));
    const expectedUsd = Math.max(0.01, Math.round((totalUsd + shippingUsd - discountUsd) * 100) / 100);

    const captureResult = await capturePayPalOrder(paypalOrderId);
    if (captureResult.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'الدفع لم يكتمل', paypalStatus: captureResult.status },
        { status: 400 }
      );
    }

    // CRITICAL: Verify captured amount matches expected (anti-tampering)
    const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = Number(capture?.amount?.value || 0);
    const capturedCurrency = capture?.amount?.currency_code;

    if (capturedCurrency !== 'USD') {
      console.error('[paypal] Currency mismatch', { expected: 'USD', got: capturedCurrency, paypalOrderId });
      return NextResponse.json({ error: 'خطأ في عملة الدفع' }, { status: 400 });
    }
    if (Math.abs(capturedAmount - expectedUsd) > 0.01) {
      console.error('[paypal] Amount mismatch', { expected: expectedUsd, captured: capturedAmount, paypalOrderId });
      return NextResponse.json({ error: 'المبلغ المدفوع لا يطابق المطلوب' }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: auth.userId,
          status: 'paid',
          total: expectedUsd,
          shippingCost: shippingUsd,
          discount: discountUsd,
          couponCode: body?.couponCode || null,
          paymentMethod: 'paypal',
          paypalOrderId,
          shippingAddress,
          notes: body?.notes || null,
          currency: 'USD',
          items: { create: resolvedItems },
        },
        include: { items: true },
      });

      const cart = await tx.cart.findUnique({ where: { userId: auth.userId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return created;
    });

    // Send order notification email to admin (async, non-blocking)
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true, email: true, phone: true },
      });
      const addr = (shippingAddress as Record<string, any>) || {};
      const subtotalUsd = order.items.reduce((s: number, it: { unitPrice: number; quantity: number }) => s + it.unitPrice * it.quantity, 0);

      await sendOrderEmails({
        orderId: order.id,
        orderNumber: order.id.slice(-6).toUpperCase(),
        items: order.items.map((it: { productName: string; productImage: string | null; quantity: number; unitPrice: number }) => ({
          productName: it.productName,
          productImage: it.productImage,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        subtotal: subtotalUsd,
        discount: order.discount ?? 0,
        couponCode: order.couponCode,
        shippingCost: order.shippingCost ?? 0,
        total: order.total,
        currency: 'USD',
        paymentMethod: 'paypal',
        customerName: `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim() || user?.name || 'ضيف',
        customerEmail: user?.email || '—',
        customerPhone: addr.phone || user?.phone || '—',
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
    } catch (emailErr) {
      console.error('[paypal capture-order email]', emailErr);
    }

    return NextResponse.json({ orderId: order.id, status: 'paid', amountUsd: expectedUsd });
  } catch (err) {
    console.error('[paypal capture-order]', err);
    return NextResponse.json({ error: 'حدث خطأ في تأكيد الدفع' }, { status: 500 });
  }
}
