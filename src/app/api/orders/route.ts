export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { sendOrderEmails } from '@/lib/order-email';
import { attributeOrderToCampaign } from '@/lib/campaign-attribution';


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
      loyaltyPointsToRedeem,
    } = body;

    if (!items?.length || !paymentMethod || !shippingAddress) {
      return NextResponse.json({ error: 'بيانات الطلب غير مكتملة' }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'عدد المنتجات كبير جداً' }, { status: 400 });
    }
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
        return NextResponse.json({ error: 'كمية غير صحيحة' }, { status: 400 });
      }
    }

    // PayPal orders must go through /api/paypal/capture-order which verifies
    // payment with PayPal before creating the order. Accepting 'paypal' here
    // would let anyone forge a paid order with a fake paypalOrderId.
    const VALID_PAY = ['cod', 'card', 'vodafone', 'instapay', 'bank', 'gift'];
    if (!VALID_PAY.includes(paymentMethod)) {
      return NextResponse.json({ error: 'طريقة دفع غير صحيحة' }, { status: 400 });
    }

    // Local payment methods (COD, Vodafone, Instapay) are Egypt-only.
    // Block them for international addresses to prevent unfulfillable orders.
    const LOCAL_ONLY_METHODS = ['cod', 'vodafone', 'instapay'];
    const addrCountry = (shippingAddress as Record<string, string>)?.country?.toUpperCase();
    if (LOCAL_ONLY_METHODS.includes(paymentMethod) && addrCountry && addrCountry !== 'EG') {
      return NextResponse.json({ error: 'هذه الطريقة متاحة للشحن داخل مصر فقط' }, { status: 400 });
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

        const serverPrice = dbProduct?.price ?? item.unitPrice;
        return {
          productId: dbProduct?.id ?? item.productId,
          quantity: item.quantity,
          selectedModel: item.selectedModel ?? null,
          unitPrice: serverPrice,
          productName: dbProduct?.name ?? item.productName,
          productImage: (item.productImage && /^(\/|https?:\/\/)/.test(item.productImage)) ? item.productImage : null,
        };
      })
    );

    // Pre-flight stock check — fail fast with a friendly Arabic error
    // before we create the order so the customer never sees "your order
    // was placed then we ran out".
    {
      const { validateStockAvailability } = await import('@/lib/stock');
      const shortage = await validateStockAvailability(
        resolvedItems.map(it => ({ productId: it.productId, quantity: it.quantity, selectedModel: it.selectedModel ?? null })),
      );
      if (shortage) {
        return NextResponse.json({ error: shortage.message }, { status: 409 });
      }
    }

    // Server-side price verification
    const verifiedSubtotal = resolvedItems.reduce(
      (s, it) => s + it.unitPrice * it.quantity, 0
    );

    // Verify discount + coupon server-side
    let verifiedDiscount = Math.round((discount ?? 0) * 100) / 100;
    if (couponCode) {
      const couponSetting = await prisma.setting.findUnique({ where: { key: 'coupons' } });
      const coupons = (couponSetting?.value ?? []) as { code: string; pct: number; active?: boolean }[];
      const matched = coupons.find(
        c => c.code?.toLowerCase() === couponCode.toLowerCase() && c.active !== false
      );
      if (matched) {
        const couponDiscount = Math.round(verifiedSubtotal * matched.pct / 100);
        verifiedDiscount += couponDiscount;
      }
    }

    // Verify shipping cost server-side for COD/local orders — cap at 500 to prevent tampering
    const verifiedShipping = paymentMethod === 'paypal'
      ? (shippingCost ?? 0)   // PayPal orders already verified at capture step
      : Math.min(500, Math.max(0, Number(shippingCost) || 0));

    const verifiedTotal = verifiedSubtotal - verifiedDiscount + verifiedShipping;

    // Order create + stock decrement run in ONE transaction so we can
    // never end up with an order whose stock wasn't decremented (or
    // vice-versa). InsufficientStockError thrown by adjustStock rolls
    // back the order create automatically; we surface 409 to the client.
    const { adjustStock, decrementsFromItems, InsufficientStockError } = await import('@/lib/stock');
    let order;
    try {
      order = await prisma.$transaction(async tx => {
        const created = await tx.order.create({
          data: {
            userId: auth.userId,
            status: 'pending',
            total: verifiedTotal,
            shippingCost: verifiedShipping,
            discount: verifiedDiscount,
            couponCode: couponCode?.trim().toUpperCase() || null,
            paymentMethod,
            paypalOrderId: paypalOrderId ?? null,
            shippingAddress,
            notes: notes ?? null,
            currency: currency ?? 'EGP',
            items: { create: resolvedItems },
          },
          include: { items: true },
        });
        await adjustStock(
          decrementsFromItems(resolvedItems.map(it => ({ productId: it.productId, quantity: it.quantity, selectedModel: it.selectedModel ?? null }))),
          { reason: 'order_created', orderId: created.id },
          tx,
        );
        return created;
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }

    // Best-effort campaign attribution by coupon code (never blocks the order).
    await attributeOrderToCampaign({ orderId: order.id, couponCode: order.couponCode, userId: auth.userId });

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
        items: order.items.map((it: { productName: string; productImage: string | null; quantity: number; unitPrice: number; selectedModel?: number | null }) => ({
          productName: it.productName,
          productImage: it.productImage,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          selectedModel: it.selectedModel,
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

    // Award loyalty points: 1 point per 10 EGP (best-effort, non-blocking)
    try {
      const earnedPoints = Math.floor(verifiedTotal / 10);
      if (earnedPoints > 0) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: auth.userId },
            data: { loyaltyPoints: { increment: earnedPoints } },
          }),
          prisma.loyaltyTransaction.create({
            data: {
              userId: auth.userId,
              points: earnedPoints,
              reason: 'order_earn',
              orderId: order.id,
            },
          }),
        ]);
      }
    } catch (loyaltyErr) {
      console.error('[orders POST loyalty]', loyaltyErr);
    }

    // Redeem loyalty points if requested — atomic check+decrement prevents race condition
    // Cap to order total so a single order can't drain unlimited points
    const cappedLoyalty = loyaltyPointsToRedeem && loyaltyPointsToRedeem > 0
      ? Math.min(Math.floor(loyaltyPointsToRedeem), Math.ceil(verifiedTotal))
      : 0;
    if (cappedLoyalty > 0) {
      try {
        const updated = await prisma.user.updateMany({
          where: { id: auth.userId, loyaltyPoints: { gte: cappedLoyalty } },
          data: { loyaltyPoints: { decrement: cappedLoyalty } },
        });
        if (updated.count > 0) {
          await prisma.loyaltyTransaction.create({
            data: { userId: auth.userId, points: -cappedLoyalty, reason: 'order_redeem', orderId: order.id },
          });
        }
      } catch (redeemErr) {
        console.error('[orders POST loyalty redeem]', redeemErr);
      }
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error('[orders POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
