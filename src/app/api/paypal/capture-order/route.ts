export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { capturePayPalOrder } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const {
      paypalOrderId,
      items,
      shippingAddress,
      shippingCost,
      discount,
      couponCode,
      notes,
      currency,
    } = await req.json();

    if (!paypalOrderId || !items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Check idempotency — don't create duplicate order for same paypalOrderId
    const existing = await prisma.order.findUnique({ where: { paypalOrderId } });
    if (existing) {
      return NextResponse.json({ orderId: existing.id, status: existing.status });
    }

    // Capture payment on PayPal
    const captureResult = await capturePayPalOrder(paypalOrderId);

    if (captureResult.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'الدفع لم يكتمل', paypalStatus: captureResult.status },
        { status: 400 }
      );
    }

    // Resolve product IDs (same logic as orders route)
    const resolvedItems = await Promise.all(
      items.map(async (item: {
        productId: string;
        quantity: number;
        selectedModel?: number;
        unitPrice: number;
        productName: string;
        productImage?: string;
      }) => {
        let dbProduct = await prisma.product.findFirst({
          where: { OR: [{ id: item.productId }, { slug: item.productId }] },
        });

        if (!dbProduct) {
          const staticP = staticProducts.find(
            p => p.id === item.productId || p.slug === item.productId
          );
          if (staticP) {
            dbProduct = await prisma.product.upsert({
              where: { slug: staticP.slug },
              create: {
                id: staticP.id,
                slug: staticP.slug,
                name: staticP.name,
                nameEn: staticP.nameEn,
                shortDescription: staticP.shortDescription,
                shortDescriptionEn: staticP.shortDescriptionEn,
                description: staticP.description,
                descriptionEn: staticP.descriptionEn,
                price: staticP.price,
                category: staticP.category,
                subcategory: staticP.subcategory,
                variants: (staticP.variants ?? []) as object[],
                tags: staticP.tags as string[],
                images: staticP.images as string[],
                inStock: staticP.inStock,
                featured: staticP.featured ?? false,
                videos: staticP.videos ?? [],
                weight: staticP.weight,
                source: 'static',
              },
              update: {},
            });
          }
        }

        return {
          productId: dbProduct?.id ?? item.productId,
          quantity: item.quantity,
          selectedModel: item.selectedModel ?? null,
          unitPrice: item.unitPrice,
          productName: item.productName,
          productImage: item.productImage ?? null,
        };
      })
    );

    // Server-side total recalculation
    let serverTotal = 0;
    for (const item of resolvedItems) {
      serverTotal += item.unitPrice * item.quantity;
    }
    const finalTotal = serverTotal - (discount || 0) + (shippingCost || 0);

    // Create order in DB with status "paid"
    const order = await prisma.order.create({
      data: {
        userId: auth.userId,
        status: 'paid',
        total: finalTotal,
        shippingCost: shippingCost ?? 0,
        discount: discount ?? 0,
        couponCode: couponCode ?? null,
        paymentMethod: 'paypal',
        paypalOrderId,
        shippingAddress,
        notes: notes ?? null,
        currency: currency ?? 'USD',
        items: { create: resolvedItems },
      },
      include: { items: true },
    });

    // Clear cart
    const cart = await prisma.cart.findUnique({ where: { userId: auth.userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return NextResponse.json({ orderId: order.id, status: 'paid' });
  } catch (err) {
    console.error('[paypal capture-order]', err);
    return NextResponse.json({ error: 'حدث خطأ في تأكيد الدفع' }, { status: 500 });
  }
}
