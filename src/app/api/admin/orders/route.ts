export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { normalizeEgyptPhone } from '@/lib/phone';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';


export async function GET(req: NextRequest) {
  try {
    const guard = await requirePerm('orders.read');
    if ('response' in guard) return guard.response;

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: true,
          shipment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.order.count(),
    ]);

    return NextResponse.json({ orders, total });
  } catch (err) {
    console.error('[admin orders GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/orders — create a manual order (e.g. from Facebook DM).
// Finds-or-creates a User by email/phone, links them as the order owner so
// they show up in the customer DB and are reachable by campaigns.
interface ManualOrderItem { productId: string; quantity: number; unitPrice: number; productName?: string; selectedModel?: number | null }
interface ManualOrderBody {
  customer: {
    name: string;
    phone: string;
    email?: string;
    governorate?: string;
    city?: string;
    region?: string;
    street?: string;
    building?: string;
    notes?: string;
    whatsappNumber?: string;
  };
  items: ManualOrderItem[];
  shippingCost?: number;
  discount?: number;
  couponCode?: string;
  paymentMethod?: string;  // cod | card | paypal | vodafone | instapay | bank
  status?: string;
  notes?: string;
  source?: string;         // facebook | whatsapp | phone | walk-in | gift
  isGift?: boolean;
  giftRecipient?: string;
  giftOccasion?: string;
  giftFreeShipping?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePerm('orders.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;
    const body = (await req.json()) as ManualOrderBody;

    if (!body?.customer?.name?.trim() || !body.customer.phone?.trim()) {
      return NextResponse.json({ error: 'اسم ورقم تليفون العميل مطلوبين' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'لازم تختار منتج واحد على الأقل' }, { status: 400 });
    }

    const phone = normalizeEgyptPhone(body.customer.phone) || body.customer.phone.trim();
    const emailInput = body.customer.email?.trim().toLowerCase();

    // 1) Find or create the user (by email first, then by phone).
    let user = null;
    if (emailInput) {
      user = await prisma.user.findUnique({ where: { email: emailInput } });
    }
    if (!user && phone) {
      user = await prisma.user.findFirst({ where: { phone } });
    }
    if (!user) {
      const syntheticEmail = emailInput || `manual-${phone || randomBytes(6).toString('hex')}@imported.local`;
      const placeholderHash = randomBytes(32).toString('hex');
      try {
        user = await prisma.user.create({
          data: {
            name: body.customer.name.trim(),
            email: syntheticEmail,
            passwordHash: placeholderHash,
            phone,
            emailVerified: false,
            marketingOptIn: false,
            role: 'customer',
          },
        });
      } catch {
        // Race / unique collision — try to fetch again.
        user = await prisma.user.findUnique({ where: { email: syntheticEmail } });
        if (!user) {
          return NextResponse.json({ error: 'تعذر إنشاء حساب العميل' }, { status: 500 });
        }
      }
    }

    // 2) Resolve items: ensure each Product exists in the DB (seed from static if needed).
    interface ResolvedItem { productId: string; productName: string; productImage: string | null; quantity: number; unitPrice: number; selectedModel: number | null }
    const resolvedItems: ResolvedItem[] = [];
    let subtotal = 0;
    for (const it of body.items) {
      if (!it.productId || !it.quantity || it.quantity < 1) continue;
      let dbProduct = await prisma.product.findUnique({ where: { id: it.productId } });
      if (!dbProduct) {
        const staticP = staticProducts.find(p => p.id === it.productId || p.slug === it.productId);
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
      if (!dbProduct) continue;
      const unitPrice = Number(it.unitPrice) || dbProduct.price;
      const productImage = Array.isArray(dbProduct.images) && dbProduct.images.length > 0
        ? (typeof dbProduct.images[0] === 'string' ? dbProduct.images[0] as string : null)
        : null;
      // Variant validation — if this product has variants/variantStocks,
      // the admin MUST pick one so per-model stock stays accurate.
      const variants = (dbProduct.variants ?? []) as unknown as Array<{ name?: string }>;
      const hasVariants = Array.isArray(variants) && variants.length > 0;
      let selectedModel: number | null = null;
      if (typeof it.selectedModel === 'number') {
        if (!hasVariants) {
          return NextResponse.json({ error: `المنتج "${dbProduct.name}" لا يحتوي على موديلات` }, { status: 400 });
        }
        if (it.selectedModel < 0 || it.selectedModel >= variants.length) {
          return NextResponse.json({ error: `موديل غير صحيح للمنتج "${dbProduct.name}"` }, { status: 400 });
        }
        selectedModel = it.selectedModel;
      } else if (hasVariants) {
        return NextResponse.json({
          error: `المنتج "${dbProduct.name}" له موديلات — اختار الموديل قبل ما تكمل`,
        }, { status: 400 });
      }
      resolvedItems.push({
        productId: dbProduct.id,
        productName: it.productName || dbProduct.name,
        productImage,
        quantity: Math.max(1, Math.floor(it.quantity)),
        unitPrice,
        selectedModel,
      });
      subtotal += unitPrice * it.quantity;
    }
    if (resolvedItems.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على أي منتج صالح' }, { status: 400 });
    }

    const isGift = body.isGift === true;
    const giftFreeShipping = isGift && body.giftFreeShipping !== false;
    const shippingCost = isGift && giftFreeShipping ? 0 : (Number(body.shippingCost) || 0);
    const discount = isGift ? 0 : (Number(body.discount) || 0);
    // Gifts: customer pays nothing for items; total reflects only the shipping
    // we are charging (zero if waived). Item subtotal is recorded as a cost via
    // the order items themselves but does NOT count towards the order total.
    const total = isGift
      ? shippingCost
      : Math.max(0, subtotal - discount + shippingCost);

    // 3) Build the shippingAddress JSON exactly as customer-flow does.
    const shippingAddress = {
      firstName: body.customer.name.trim().split(/\s+/)[0] || '',
      lastName: body.customer.name.trim().split(/\s+/).slice(1).join(' ') || '',
      phone,
      whatsappNumber: body.customer.whatsappNumber || '',
      email: emailInput || '',
      street: body.customer.street || '',
      building: body.customer.building || '',
      city: body.customer.city || '',
      region: body.customer.region || '',
      governorate: body.customer.governorate || '',
      country: 'EG',
      notes: body.customer.notes || '',
    };

    const giftTag = isGift
      ? `[Gift${body.giftRecipient ? ` to: ${body.giftRecipient.trim()}` : ''}${body.giftOccasion ? ` · Occasion: ${body.giftOccasion.trim()}` : ''}]`
      : null;
    const sourceTag = body.source && !isGift ? `[Source: ${body.source}]` : null;
    const composedNotes = [body.notes, giftTag, sourceTag].filter(Boolean).join(' · ') || null;

    // Pre-flight stock validation — refuse the order with a friendly
    // Arabic message if any line would push stock below zero.
    {
      const { validateStockAvailability } = await import('@/lib/stock');
      const shortage = await validateStockAvailability(
        resolvedItems.map(it => ({ productId: it.productId, quantity: it.quantity, selectedModel: it.selectedModel ?? null })),
      );
      if (shortage) {
        return NextResponse.json({ error: shortage.message }, { status: 409 });
      }
    }

    // Order create + stock decrement in one transaction. Race-induced
    // shortage rolls back the order; admin sees a 409 with which line failed.
    const { adjustStock, decrementsFromItems, InsufficientStockError } = await import('@/lib/stock');
    let order;
    try {
      order = await prisma.$transaction(async tx => {
        const created = await tx.order.create({
          data: {
            userId: user.id,
            status: body.status || (isGift ? 'paid' : (body.paymentMethod === 'cod' ? 'pending' : 'paid')),
            total,
            shippingCost,
            discount,
            couponCode: isGift ? null : (body.couponCode || null),
            paymentMethod: isGift ? 'gift' : (body.paymentMethod || 'cod'),
            shippingAddress: shippingAddress as unknown as object,
            notes: composedNotes,
            currency: 'EGP',
            // Stamp who placed the manual order so the audit can re-resolve
            // attribution months later even if the AuditLog row is purged.
            createdByUserId: auth.userId,
            items: { create: resolvedItems },
          },
          include: { items: true, user: { select: { id: true, name: true, email: true } } },
        });
        await adjustStock(
          decrementsFromItems(resolvedItems.map(it => ({ productId: it.productId, quantity: it.quantity, selectedModel: it.selectedModel ?? null }))),
          { reason: 'order_created', orderId: created.id, adminId: auth.userId },
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

    await logActionSafe({
      actor: auth,
      action: 'order.create-manual',
      entity: 'Order',
      entityId: order.id,
      after: {
        total: order.total,
        paymentMethod: order.paymentMethod,
        itemCount: resolvedItems.length,
        customerEmail: order.user.email,
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ في الخادم';
    console.error('[admin orders POST]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
