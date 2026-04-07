export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { sendOrderEmails } from '@/lib/order-email';


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
      paypalOrderId,
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
        status: paymentMethod === 'paypal' && paypalOrderId ? 'paid' : 'pending',
        total: total ?? 0,
        shippingCost: shippingCost ?? 0,
        discount: discount ?? 0,
        couponCode: couponCode ?? null,
        paymentMethod,
        paypalOrderId: paypalOrderId ?? null,
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

    // Send order notification email to admin (async, non-blocking)
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true, email: true, phone: true },
      });
      const addr = (shippingAddress as Record<string, any>) || {};
      const dialCode = addr.country ? '' : '';
      const customerPhone = `${dialCode}${addr.phone || user?.phone || ''}`.trim();
      const subtotal = order.items.reduce((s: number, it: { unitPrice: number; quantity: number }) => s + it.unitPrice * it.quantity, 0);

      await sendOrderEmails({
        orderId: order.id,
        orderNumber: order.id.slice(-6).toUpperCase(),
        items: order.items.map((it: { productName: string; productImage: string | null; quantity: number; unitPrice: number }) => ({
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
        customerName: `${addr.firstName ?? ''} ${addr.lastName ?? ''}`.trim() || user?.name || 'ضيف',
        customerEmail: user?.email || '—',
        customerPhone: customerPhone || '—',
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
      console.error('[orders POST email]', emailErr);
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error('[orders POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
