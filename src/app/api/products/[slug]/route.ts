export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyOverride, getMergedStaticProduct, loadStaticOverrides } from '@/lib/product-overrides';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Try DB row first (handles admin-created products + the seeded copy
    // of static products). For static-sourced rows, apply overrides via
    // the shared helper so prices stay consistent with the home/list pages.
    const dbProduct = await prisma.product.findUnique({ where: { slug } });
    if (dbProduct) {
      if (dbProduct.source === 'static') {
        const overrides = await loadStaticOverrides();
        const merged = applyOverride(dbProduct as unknown as import('@/types').Product, overrides[dbProduct.id]);
        if (!merged) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
        return NextResponse.json({ product: merged, source: 'static' });
      }
      return NextResponse.json({ product: dbProduct });
    }

    // No DB row — fall back to pure static lookup with overrides applied.
    const staticMerged = await getMergedStaticProduct(slug);
    if (staticMerged) return NextResponse.json({ product: staticMerged, source: 'static' });

    return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
  } catch (err) {
    console.error('[product slug GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const guard = await requirePerm('products.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { slug } = await params;
    const body = await req.json();
    const ALLOWED = [
      'name', 'nameEn', 'description', 'descriptionEn', 'shortDescription', 'shortDescriptionEn',
      'price', 'priceUsd', 'category', 'subcategory', 'tags', 'images', 'variants',
      'inStock', 'featured', 'videos', 'weight',
    ];
    const data: Record<string, unknown> = {};
    for (const k of ALLOWED) if (k in body) data[k] = body[k];

    const product = await prisma.product.update({ where: { slug }, data });
    await logActionSafe({
      actor: auth,
      action: 'product.update',
      entity: 'Product',
      entityId: product.id,
      metadata: { slug, fields: Object.keys(data) },
    });
    return NextResponse.json({ product });
  } catch (err) {
    console.error('[product slug PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
