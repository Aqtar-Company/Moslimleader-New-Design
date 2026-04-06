export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';


async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// In-memory cache to speed up repeated admin page loads (5 seconds TTL)
// Admin edits invalidate the cache explicitly via PUT/POST/DELETE
let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000;

export function invalidateAdminProductsCache() {
  cache = null;
}

// GET /api/admin/products — returns all DB products (source='admin') + static products merged with overrides
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    // Serve from cache if fresh
    if (cache && Date.now() < cache.expiresAt) {
      return NextResponse.json(cache.data);
    }

    // Parallelize DB queries
    const [dbProducts, overrideSetting] = await Promise.all([
      prisma.product.findMany({
        where: { source: 'admin' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.setting.findUnique({ where: { key: 'product-overrides' } }),
    ]);

    const overrides: Record<string, Record<string, unknown>> = (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};

    // Merge static products with overrides
    const mergedStatic = staticProducts.map(p => ({
      ...p,
      ...(overrides[p.id] ?? {}),
      isAdded: false,
    }));

    const adminProducts = dbProducts.map((p: (typeof dbProducts)[number]) => ({ ...p, isAdded: true }));

    const payload = { products: [...mergedStatic, ...adminProducts] };
    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[admin products GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/products — add new product to DB
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

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
        tags: tags ?? [], images: images ?? [],
        inStock: inStock !== false, weight: weight ?? 0,
        videoUrl: body.videoUrl ?? null,
        source: 'admin',
        updatedAt: new Date(),
      },
    });

    // Invalidate cache so next GET returns fresh data
    invalidateAdminProductsCache();

    return NextResponse.json({ product });
  } catch (err) {
    console.error('[admin products POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
