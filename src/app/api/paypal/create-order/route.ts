export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { createPayPalOrder } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { egpToUsd, toUsd } from '@/lib/currency';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول للدفع عبر PayPal' }, { status: 401 });
    }

    const body = await req.json();
    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'السلة فارغة' }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'عدد المنتجات كبير جداً' }, { status: 400 });
    }

    // Currency of the discount and shipping amounts sent from the frontend
    // e.g. 'SAR', 'EGP', 'USD', 'AED' ...
    const discountCurrency: string = String(body?.discountCurrency || 'USD').toUpperCase();
    const shippingCurrency: string = String(body?.shippingCurrency || 'USD').toUpperCase();

    // Batch-fetch all products in one query instead of N+1
    const productIds = items.map((it: any) => String(it.productId));
    const dbProducts = await prisma.product.findMany({
      where: { OR: [{ id: { in: productIds } }, { slug: { in: productIds } }] },
    });
    const dbMap = new Map(dbProducts.flatMap(p => [[p.id, p], [p.slug, p]]));

    let totalUsd = 0;
    for (const item of items) {
      const qty = Number(item?.quantity);
      if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
        return NextResponse.json({ error: 'كمية غير صحيحة' }, { status: 400 });
      }

      const pid = String(item.productId);
      const dbProduct = dbMap.get(pid) ?? null;
      const staticP: any = !dbProduct
        ? staticProducts.find(p => p.id === pid || p.slug === pid)
        : null;
      const product: any = dbProduct || staticP;

      if (!product) {
        return NextResponse.json({ error: 'منتج غير موجود' }, { status: 400 });
      }
      if (dbProduct && dbProduct.inStock === false) {
        return NextResponse.json({ error: `المنتج غير متوفر: ${product.name}` }, { status: 400 });
      }

      const unitUsd = product.priceUsd && product.priceUsd > 0
        ? Number(product.priceUsd)
        : egpToUsd(Number(product.price));

      if (!Number.isFinite(unitUsd) || unitUsd <= 0) {
        return NextResponse.json({ error: 'خطأ في سعر المنتج' }, { status: 400 });
      }
      totalUsd += unitUsd * qty;
    }

    // Pre-validate stock BEFORE PayPal collects payment. Capture is the next
    // hop and will decrement; if we let an over-sold cart reach PayPal, the
    // customer gets charged for items we can't ship.
    const { validateStockAvailability } = await import('@/lib/stock');
    const stockErr = await validateStockAvailability(items.map((it: any) => ({
      productId: String(it.productId),
      quantity: Number(it.quantity),
      selectedModel: typeof it.selectedModel === 'number' ? it.selectedModel : null,
    })));
    if (stockErr) {
      return NextResponse.json({ error: stockErr.message }, { status: 409 });
    }

    // Convert shipping from local currency to USD
    const rawShipping = Math.max(0, Number(body?.shippingUsd) || 0);
    const shippingUsd = Math.min(500, toUsd(rawShipping, shippingCurrency));

    // Discount: either percentage (discountCurrency === 'PCT') or local currency amount
    const rawDiscount = Math.max(0, Number(body?.discountUsd) || 0);
    let discountUsd: number;
    if (discountCurrency === 'PCT') {
      // rawDiscount is a percentage (e.g. 95 = 95%)
      const pct = Math.min(100, rawDiscount);
      discountUsd = Math.round(totalUsd * pct) / 100;
    } else {
      discountUsd = Math.min(totalUsd + shippingUsd, toUsd(rawDiscount, discountCurrency));
    }

    const finalUsd = Math.max(0.01, Math.round((totalUsd + shippingUsd - discountUsd) * 100) / 100);
    const referenceId = `${auth.userId}-${Date.now()}`;
    const paypalOrder = await createPayPalOrder(finalUsd, 'USD', referenceId);

    return NextResponse.json({
      paypalOrderId: paypalOrder.id,
      expectedAmountUsd: finalUsd,
    });
  } catch (err) {
    console.error('[paypal create-order]', err);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء طلب الدفع' }, { status: 500 });
  }
}
