export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { createPayPalOrder } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { items, shippingCost, discount, currency } = await req.json();

    if (!items?.length) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Server-side total validation — never trust client amount
    let serverTotal = 0;
    for (const item of items) {
      const dbProduct = await prisma.product.findFirst({
        where: { OR: [{ id: item.productId }, { slug: item.productId }] },
      });

      const staticP = !dbProduct
        ? staticProducts.find(p => p.id === item.productId || p.slug === item.productId)
        : null;

      const product = dbProduct || staticP;
      if (!product) {
        return NextResponse.json({ error: `منتج غير موجود: ${item.productId}` }, { status: 400 });
      }

      // Use USD price if available, otherwise fallback to price
      const unitPrice = currency === 'USD' && 'priceUsd' in product && product.priceUsd
        ? product.priceUsd
        : product.price;
      serverTotal += unitPrice * item.quantity;
    }

    // Apply discount and shipping
    const finalAmount = serverTotal - (discount || 0) + (shippingCost || 0);

    if (finalAmount <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صحيح' }, { status: 400 });
    }

    const paypalCurrency = currency === 'EGP' ? 'USD' : (currency || 'USD');
    const referenceId = `${auth.userId}-${Date.now()}`;

    const paypalOrder = await createPayPalOrder(finalAmount, paypalCurrency, referenceId);

    return NextResponse.json({ paypalOrderId: paypalOrder.id });
  } catch (err) {
    console.error('[paypal create-order]', err);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء طلب PayPal' }, { status: 500 });
  }
}
