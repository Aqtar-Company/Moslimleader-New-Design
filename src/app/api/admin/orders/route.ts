export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { normalizeEgyptPhone } from '@/lib/phone';


export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

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
interface ManualOrderItem { productId: string; quantity: number; unitPrice: number; productName?: string }
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
  source?: string;         // facebook | whatsapp | phone | walk-in
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
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
    const resolvedItems = [];
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
      resolvedItems.push({
        productId: dbProduct.id,
        productName: it.productName || dbProduct.name,
        productImage,
        quantity: Math.max(1, Math.floor(it.quantity)),
        unitPrice,
      });
      subtotal += unitPrice * it.quantity;
    }
    if (resolvedItems.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على أي منتج صالح' }, { status: 400 });
    }

    const shippingCost = Number(body.shippingCost) || 0;
    const discount = Number(body.discount) || 0;
    const total = Math.max(0, subtotal - discount + shippingCost);

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

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        status: body.status || (body.paymentMethod === 'cod' ? 'pending' : 'paid'),
        total,
        shippingCost,
        discount,
        couponCode: body.couponCode || null,
        paymentMethod: body.paymentMethod || 'cod',
        shippingAddress: shippingAddress as unknown as object,
        notes: [body.notes, body.source ? `[Source: ${body.source}]` : null].filter(Boolean).join(' · ') || null,
        currency: 'EGP',
        items: { create: resolvedItems },
      },
      include: { items: true, user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ في الخادم';
    console.error('[admin orders POST]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
