export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { createPayPalOrder } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { egpToUsd, toUsd } from '@/lib/currency';
import { applyOverride, loadStaticOverrides } from '@/lib/product-overrides';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول للدفع عبر PayPal' }, { status: 401 });
    }

    // Rate limit: 10 create-order requests per user per hour
    const rl = checkRateLimit(`paypal-create:${auth.userId}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'تجاوزت الحد المسموح به، حاول لاحقاً' }, { status: 429 });
    }

    const body = await req.json();
    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'السلة فارغة' }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'عدد المنتجات كبير جداً' }, { status: 400 });
    }

    const shippingCurrency: string = String(body?.shippingCurrency || 'USD').toUpperCase();
    const couponCode: string = String(body?.couponCode || '').trim().toUpperCase();

    // Batch-fetch all products in one query instead of N+1
    const productIds = items.map((it: any) => String(it.productId));
    const dbProducts = await prisma.product.findMany({
      where: { OR: [{ id: { in: productIds } }, { slug: { in: productIds } }] },
    });

    // Apply product overrides for static products (admin price/image changes)
    const overrides = await loadStaticOverrides().catch(() => ({}) as Record<string, any>);
    const dbProductsWithOverrides = dbProducts.map(p =>
      p.source === 'static' ? (applyOverride(p as any, (overrides as Record<string, any>)[p.id]) ?? p) : p
    );
    const dbMap = new Map(dbProductsWithOverrides.flatMap(p => [[p.id, p], [p.slug, p]]));

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

    // Convert shipping from local currency to USD (client-supplied, capped)
    const rawShipping = Math.max(0, Number(body?.shippingUsd) || 0);
    const shippingUsd = Math.min(500, toUsd(rawShipping, shippingCurrency));

    // Validate coupon server-side — never trust client-supplied discount amounts
    let discountUsd = 0;
    if (couponCode) {
      // Try new Coupon model first
      const coupon = await prisma.coupon.findFirst({
        where: { code: couponCode, isActive: true },
        select: { discount: true },
      }).catch(() => null);
      if (coupon) {
        const pct = Math.min(100, Number(coupon.discount));
        discountUsd = Math.round(totalUsd * pct) / 100;
      } else {
        // Fallback: legacy Setting-based coupons
        const setting = await prisma.setting.findUnique({ where: { key: 'coupons' } }).catch(() => null);
        const legacyCoupons = (setting?.value ?? []) as { code: string; pct: number; active?: boolean }[];
        const matched = legacyCoupons.find(c => c.code?.toLowerCase() === couponCode.toLowerCase() && c.active !== false);
        if (matched) discountUsd = Math.round(totalUsd * matched.pct) / 100;
      }
    }

    const finalUsd = Math.max(0.01, Math.round((totalUsd + shippingUsd - discountUsd) * 100) / 100);
    const referenceId = `${auth.userId}-${Date.now()}`;
    const paypalOrder = await createPayPalOrder(finalUsd, 'USD', referenceId);

    // Persist the server-verified amounts so capture-order can cross-check
    // without trusting anything from the client body.
    await prisma.setting.upsert({
      where: { key: `pp_pending_${paypalOrder.id}` },
      create: { key: `pp_pending_${paypalOrder.id}`, value: { expectedUsd: finalUsd, discountUsd, couponCode: couponCode || null, userId: auth.userId, createdAt: Date.now() } },
      update: { value: { expectedUsd: finalUsd, discountUsd, couponCode: couponCode || null, userId: auth.userId, createdAt: Date.now() } },
    });

    return NextResponse.json({
      paypalOrderId: paypalOrder.id,
      expectedAmountUsd: finalUsd,
    });
  } catch (err) {
    console.error('[paypal create-order]', err);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء طلب الدفع' }, { status: 500 });
  }
}
