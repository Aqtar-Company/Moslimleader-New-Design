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
            variants, tags, images, inStock, weight, minAge, maxAge, needsParentalGuide } = body;

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
        // Age targeting (FB AI assistant). Clamp to 0-18 / null.
        minAge: typeof minAge === 'number' ? Math.max(0, Math.min(18, Math.floor(minAge))) : null,
        maxAge: typeof maxAge === 'number' ? Math.max(0, Math.min(18, Math.floor(maxAge))) : null,
        needsParentalGuide: typeof needsParentalGuide === 'boolean' ? needsParentalGuide : false,
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

    return NextResponse.json({ product });
  } catch (err) {
    console.error('[admin products POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
