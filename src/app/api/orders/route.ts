import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

export const dynamic = 'force-dynamic';

// GET /api/orders — list current user's orders
export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const orders = await prisma.order.findMany({
      where: { userId: auth.userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (err) {
    console.error('[orders GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/orders — create new order
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const body = await req.json();
    const {
      items,           // [{ productId, quantity, selectedModel, unitPrice, productName, productImage }]
      total,
      shippingCost,
      discount,
      couponCode,
      paymentMethod,
      shippingAddress,
      notes,
      currency,
    } = body;

    if (!items?.length || !paymentMethod || !shippingAddress) {
      return NextResponse.json({ error: 'بيانات الطلب غير مكتملة' }, { status: 400 });
    }

    // Resolve productId for each item (handle static products which have string IDs)
    const resolvedItems = await Promise.all(
      items.map(async (item: {
        productId: string;
        quantity: number;
        selectedModel?: number;
        unitPrice: number;
        productName: string;
        productImage?: string;
      }) => {
        // Try to find product in DB first
        let dbProduct = await prisma.product.findFirst({
          where: {
            OR: [
              { id: item.productId },
              { slug: item.productId },
            ],
          },
        });

        // If not in DB, seed the static product on-the-fly
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

    const order = await prisma.order.create({
      data: {
        userId: auth.userId,
        status: 'pending',
        total: total ?? 0,
        shippingCost: shippingCost ?? 0,
        discount: discount ?? 0,
        couponCode: couponCode ?? null,
        paymentMethod,
        shippingAddress,
        notes: notes ?? null,
        currency: currency ?? 'EGP',
        items: {
          create: resolvedItems,
        },
      },
      include: { items: true },
    });

    // Clear server cart after successful order
    const cart = await prisma.cart.findUnique({ where: { userId: auth.userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error('[orders POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
