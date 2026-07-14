export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { sendOrderEmails } from '@/lib/order-email';
import { checkRateLimit } from '@/lib/rate-limit';
import { applyOverride, loadStaticOverrides } from '@/lib/product-overrides';

// POST /api/orders/guest-notify — guest checkout endpoint.
//
// Originally this only emailed the admin and DID NOT save the order
// (the comment in checkout/page.tsx still says "no DB save — userId
// required"). That meant guest orders never appeared on /admin/orders
// — owner discovered an order in the email inbox that wasn't in the
// orders dashboard. Now we:
//   1. Get-or-create a synthetic "guest" User keyed on phone number
//      so repeat guests reuse the same record.
//   2. Create a real Order + OrderItem rows under that user with
//      paymentMethod from the body (cod / instapay / vodafone / card).
//   3. Send the same admin notification email as before.
// The email still goes out even if the DB write fails so the owner
// doesn't lose the lead in either case.
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

    const addr = (shippingAddress ?? {}) as Record<string, unknown>;

    const nameOk = (s: unknown) => typeof s === 'string' && s.trim().length >= 2 && /[؀-ۿa-zA-Z]{2,}/.test(s);
    const phoneOk = (s: unknown) => typeof s === 'string' && /^[+\d\s()-]{7,20}$/.test(s.trim());
    const streetOk = (s: unknown) => typeof s === 'string' && s.trim().length >= 4;

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
    if (!paymentMethod || !['cod', 'card', 'vodafone', 'instapay'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'طريقة دفع غير صحيحة' }, { status: 400 });
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

    const firstName = String(addr.firstName).trim();
    const lastName  = String(addr.lastName).trim();
    const customerName = `${firstName} ${lastName}`.trim() || 'ضيف';
    const phoneRaw = String(addr.phone).trim();
    const phoneClean = phoneRaw.replace(/\D/g, '');
    // Synthetic email keyed on the cleaned phone — keeps a single
    // User row per phone across repeat guest orders.
    const syntheticEmail = `guest-${phoneClean || `ip-${ip.replace(/\./g, '-')}-${Date.now()}`}@guest.moslimleader.com`;

    // Shared server-computed values (populated inside the try block; used in email below)
    let serverSubtotal = 0;
    let serverShipping = 0;
    let serverDiscount = 0;
    let serverTotal = 0;
    let couponStr = '';
    let resolvedItemsForEmail: Array<{ productName: string; productImage: string | null; quantity: number; unitPrice: number }> = [];

    let createdOrderId: string | null = null;
    try {
      // Resolve every cart item's productId to a real Product row
      // (DB row, or upsert from staticProducts on first sale). Guest
      // checkouts can carry static-product slugs that aren't in the
      // Product table yet — without this resolution the OrderItem FK
      // would fail. Mirrors the auth'd /api/orders POST flow.
      const overrides = await loadStaticOverrides().catch(() => ({}) as Record<string, any>);
      const resolvedItems = await Promise.all(
        items.map(async (item: { productId?: string; productName?: string; productImage?: string | null; quantity?: number; unitPrice?: number; selectedModel?: number }) => {
          const reqId = String(item.productId ?? '').trim();
          let dbProduct = reqId
            ? await prisma.product.findFirst({ where: { OR: [{ id: reqId }, { slug: reqId }] } })
            : null;
          if (!dbProduct && reqId) {
            const staticP = staticProducts.find(p => p.id === reqId || p.slug === reqId);
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
          // Apply product overrides for static products (admin price changes)
          const merged = dbProduct && dbProduct.source === 'static'
            ? (applyOverride(dbProduct as any, (overrides as Record<string, any>)[dbProduct.id]) ?? dbProduct)
            : dbProduct;
          return {
            productId: merged?.id ?? null,
            productName: merged?.name ?? item.productName ?? 'منتج',
            productImage: item.productImage ?? null,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(merged?.price ?? 0),
            selectedModel: item.selectedModel ?? null,
          };
        })
      );

      // If any item failed to resolve to a real product, bail out
      // BEFORE writing the order — better than creating a half-broken
      // record that won't render in /admin/orders.
      const unresolved = resolvedItems.filter(r => !r.productId);
      if (unresolved.length > 0) {
        throw new Error(`Could not resolve ${unresolved.length} product(s) for guest order — names: ${unresolved.map(u => u.productName).join(', ')}`);
      }

      // Server-side price recalculation — never trust client totals
      serverSubtotal = resolvedItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      serverShipping = Math.min(500, Math.max(0, Number(shippingCost) || 0));
      resolvedItemsForEmail = resolvedItems.map(r => ({
        productName: r.productName,
        productImage: r.productImage,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
      }));

      // Validate coupon server-side
      couponStr = String(couponCode || '').trim().toUpperCase();
      if (couponStr) {
        const coupon = await prisma.coupon.findFirst({
          where: { code: couponStr, isActive: true },
          select: { discount: true },
        }).catch(() => null);
        if (coupon) {
          serverDiscount = Math.round(serverSubtotal * Math.min(100, Number(coupon.discount))) / 100;
        } else {
          const setting = await prisma.setting.findUnique({ where: { key: 'coupons' } }).catch(() => null);
          const legacyCoupons = (setting?.value ?? []) as { code: string; pct: number; active?: boolean }[];
          const matched = legacyCoupons.find(c => c.code?.toUpperCase() === couponStr && c.active !== false);
          if (matched) serverDiscount = Math.round(serverSubtotal * matched.pct) / 100;
        }
      }

      serverTotal = Math.max(0, serverSubtotal - serverDiscount + serverShipping);

      const guestUser = await prisma.user.upsert({
        where: { email: syntheticEmail },
        create: {
          email: syntheticEmail,
          name: customerName,
          phone: phoneRaw,
          // Random non-usable password — guest user can never log in
          // with this account; it's a placeholder for the FK.
          passwordHash: `guest-${Math.random().toString(36).slice(2)}`,
          role: 'customer',
          emailVerified: false,
        },
        update: {
          // Refresh name + phone in case the same guest tweaked them.
          name: customerName,
          phone: phoneRaw,
        },
      });

      const order = await prisma.order.create({
        data: {
          userId: guestUser.id,
          status: 'pending',
          total: serverTotal,
          shippingCost: serverShipping,
          discount: serverDiscount,
          couponCode: couponStr || null,
          paymentMethod,
          currency: currency ?? 'EGP',
          shippingAddress: addr as object,
          notes: typeof notes === 'string' ? notes : null,
          items: {
            create: resolvedItems.map(r => ({
              productId: r.productId as string,
              productName: r.productName,
              productImage: r.productImage,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              selectedModel: r.selectedModel,
            })),
          },
        },
      });
      createdOrderId = order.id;
    } catch (err) {
      // Persist failure must NOT block the email — owner still gets
      // the lead even if the DB write hits a constraint we missed.
      console.error('[guest-notify] DB save failed, continuing to email', err);
    }

    // Use server-computed totals; fall back to client-supplied values (not zero) when
    // product resolution failed — the email still goes out so the admin gets the lead.
    const clientSubtotal = items.reduce(
      (s: number, it: { unitPrice?: number; quantity?: number }) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
      0,
    );
    const emailItems = resolvedItemsForEmail.length > 0
      ? resolvedItemsForEmail
      : items.map((it: { productName?: string; productImage?: string | null; quantity?: number; unitPrice?: number }) => ({
          productName: it.productName ?? 'منتج',
          productImage: it.productImage ?? null,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
        }));
    const emailSubtotal = serverSubtotal > 0 ? serverSubtotal : clientSubtotal;
    const emailTotal = serverTotal > 0 ? serverTotal : (Number(total) || clientSubtotal);

    await sendOrderEmails({
      orderId: createdOrderId ?? `GUEST-${Date.now()}`,
      orderNumber: orderNumber || String(Math.floor(100000 + Math.random() * 900000)),
      items: emailItems,
      subtotal: emailSubtotal,
      discount: serverDiscount,
      couponCode: couponStr || null,
      shippingCost: serverShipping,
      total: emailTotal,
      currency: currency ?? 'EGP',
      paymentMethod,
      customerName,
      customerEmail: '—',
      customerPhone: phoneRaw,
      shippingAddress: {
        street: addr.street as string,
        building: addr.building as string,
        city: addr.city as string,
        region: addr.region as string,
        governorate: addr.governorate as string,
        country: addr.country as string,
      },
      notes: typeof notes === 'string' ? notes : null,
    });

    return NextResponse.json({ success: true, orderId: createdOrderId, persisted: !!createdOrderId });
  } catch (err) {
    console.error('[guest-notify]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
