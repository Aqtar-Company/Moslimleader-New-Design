export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMergedStaticProducts } from '@/lib/product-overrides';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import {
  getAdminProductsCache,
  setAdminProductsCache,
  invalidateAdminProductsCache,
} from '@/lib/admin-products-cache';
import { invalidateAssistantContext } from '@/lib/assistant-knowledge';
import { getTransporter } from '@/lib/smtp';

// Returns only fields needed for the admin list/pricing table views
function toListItem(p: unknown) {
  const q = p as Record<string, unknown>;
  return {
    id: q.id,
    slug: q.slug,
    name: q.name,
    nameEn: q.nameEn,
    category: q.category,
    price: q.price,
    priceUsd: q.priceUsd,
    inStock: q.inStock,
    isAdded: q.isAdded,
    images: Array.isArray(q.images) ? q.images.slice(0, 1) : [],
  };
}

// GET /api/admin/products — returns all DB products (source='admin') + static products merged with overrides
export async function GET(req: NextRequest) {
  try {
    const guard = await requirePerm(['products.read', 'products.write'] as Permission[]);
    if ('response' in guard) return guard.response;

    // Serve from cache if fresh
    const cached = getAdminProductsCache() as { products: unknown[] } | null;
    if (cached) {
      const lite = req.nextUrl.searchParams.get('lite') === 'true';
      if (lite) {
        const stripped = cached.products.map(toListItem);
        return NextResponse.json({ products: stripped });
      }
      return NextResponse.json(cached);
    }

    // Parallelize DB queries — use the shared helper for static merging
    // so prices stay aligned with /api/products and the home page.
    const [dbProducts, mergedStatic] = await Promise.all([
      prisma.product.findMany({
        where: { source: 'admin' },
        orderBy: { createdAt: 'desc' },
      }),
      getMergedStaticProducts(),
    ]);

    const mergedStaticTagged = mergedStatic.map(p => ({ ...p, isAdded: false }));
    const adminProducts = dbProducts.map((p: (typeof dbProducts)[number]) => ({ ...p, isAdded: true }));

    const payload = { products: [...mergedStaticTagged, ...adminProducts] };
    setAdminProductsCache(payload);

    const lite = req.nextUrl.searchParams.get('lite') === 'true';
    if (lite) {
      return NextResponse.json({ products: payload.products.map(toListItem) });
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[admin products GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/products — add new product to DB
export async function POST(req: NextRequest) {
  try {
    const guard = await requirePerm('products.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const body = await req.json();
    const { slug, name, nameEn, shortDescription, shortDescriptionEn,
            description, descriptionEn, price, priceUsd, category, subcategory,
            variants, tags, images, inStock, weight } = body;

    if (!slug || !name || price === undefined || !category) {
      return NextResponse.json({ error: 'الحقول المطلوبة: slug, name, price, category' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        slug, name, nameEn, shortDescription: shortDescription || '',
        shortDescriptionEn, description: description || '',
        descriptionEn,
        price: Number(price),
        priceUsd: priceUsd !== undefined ? Number(priceUsd) : 0,
        category,
        subcategory, variants: variants ?? null,
        tags: tags ?? [], images: Array.isArray(images) ? images.slice(0, 10) : [],
        inStock: inStock !== false, weight: weight ?? 0,
        ageGroups: Array.isArray(body.ageGroups) && body.ageGroups.length > 0 ? body.ageGroups : null,
        gender: body.gender || null,
        variantStocks: body.variantStocks ?? null,
        comingSoon: body.comingSoon === true,
        videoUrl: body.videoUrl ?? null,
        source: 'admin',
        updatedAt: new Date(),
      },
    });

    // Invalidate cache so next GET returns fresh data + bust the
    // assistant's catalogue context so Amin sees the new product
    // immediately instead of waiting up to 5 min for TTL expiry.
    invalidateAdminProductsCache();
    invalidateAssistantContext();

    await logActionSafe({
      actor: auth,
      action: 'product.create',
      entity: 'Product',
      entityId: product.id,
      after: { slug: product.slug, name: product.name, price: product.price, category: product.category },
    });

    // Notify users about new product (fire-and-forget)
    notifyUsersNewProduct({
      name: product.name,
      slug: product.slug,
      images: product.images,
    }).catch(() => {});

    return NextResponse.json({ product });
  } catch (err) {
    console.error('[admin products POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

async function notifyUsersNewProduct(product: { name: string; slug: string; images: unknown }) {
  const users = await prisma.user.findMany({
    where: { marketingOptIn: true },
    select: { id: true, email: true },
  });
  if (users.length === 0) return;

  // In-app TareeqNotification for every opted-in user
  await prisma.tareeqNotification.createMany({
    data: users.map(u => ({
      userId: u.id,
      type: 'product_new',
      actorName: 'مسلم ليدر',
      body: product.name,
      postId: product.slug,
    })),
    skipDuplicates: true,
  }).catch(() => {});

  // Marketing email
  const fromEmail = process.env.SMTP_USER || 'orders@moslimleader.com';
  const transporter = getTransporter();
  const imageUrl = Array.isArray(product.images) ? (product.images as string[])[0] ?? null : null;

  const html = `
    <div dir="rtl" style="font-family:Cairo,Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
      <div style="background:linear-gradient(135deg,#1a1a2e,#0f3460);padding:24px 28px;text-align:center;">
        <p style="color:#FFCC00;font-size:22px;font-weight:900;margin:0;">منتج جديد في المتجر 🛍️</p>
      </div>
      ${imageUrl ? `<img src="${imageUrl}" alt="" style="width:100%;max-height:220px;object-fit:cover;">` : ''}
      <div style="padding:24px 28px;">
        <p style="font-size:18px;font-weight:800;color:#1a1a2e;margin:0 0 16px;">${product.name}</p>
        <a href="https://moslimleader.com/shop/${product.slug}"
          style="display:inline-block;background:#FFCC00;color:#1a1a2e;font-weight:800;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;">
          شاهد المنتج
        </a>
        <p style="color:#aaa;font-size:11px;margin:20px 0 0;">
          يمكنك إلغاء إشعارات المتجر من <a href="https://moslimleader.com/account" style="color:#d4a843;">إعدادات حسابك</a>
        </p>
      </div>
    </div>`;

  for (const u of users) {
    if (!u.email) continue;
    await transporter.sendMail({
      from: `"مسلم ليدر" <${fromEmail}>`,
      to: u.email,
      subject: `منتج جديد: ${product.name}`,
      html,
    }).catch(() => {});
  }
}
