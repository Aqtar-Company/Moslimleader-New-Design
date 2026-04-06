export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { createPayPalOrder } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

const EGP_TO_USD = 1 / 50;

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

    let totalUsd = 0;
    for (const item of items) {
      const qty = Number(item?.quantity);
      if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
        return NextResponse.json({ error: 'كمية غير صحيحة' }, { status: 400 });
      }

      const dbProduct = await prisma.product.findFirst({
        where: { OR: [{ id: String(item.productId) }, { slug: String(item.productId) }] },
      });
      const staticP: any = !dbProduct
        ? staticProducts.find(p => p.id === item.productId || p.slug === item.productId)
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
        : Number(product.price) * EGP_TO_USD;

      if (!Number.isFinite(unitUsd) || unitUsd <= 0) {
        return NextResponse.json({ error: 'خطأ في سعر المنتج' }, { status: 400 });
      }
      totalUsd += unitUsd * qty;
    }

    const shippingUsd = Math.max(0, Math.min(500, Number(body?.shippingUsd) || 0));
    const discountUsd = Math.max(0, Math.min(totalUsd, Number(body?.discountUsd) || 0));

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
