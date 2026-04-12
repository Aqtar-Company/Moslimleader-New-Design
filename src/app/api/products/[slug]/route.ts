export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Load admin overrides
    let overrides: Record<string, Record<string, unknown>> = {};
    try {
      const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
      overrides = (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};
    } catch {}

    // Try DB product first
    const product = await prisma.product.findUnique({ where: { slug } });
    if (product) {
      // Static-sourced products in DB may have stale prices — apply overrides
      if (product.source === 'static') {
        const override = overrides[product.id];
        if (override && Object.keys(override).length > 0) {
          return NextResponse.json({ product: { ...product, ...override }, source: 'static' });
        }
      }
      return NextResponse.json({ product });
    }

    // Fallback to pure static products
    const staticProduct = staticProducts.find(p => p.slug === slug);
    if (staticProduct) {
      const productWithOverrides = { ...staticProduct, ...(overrides[staticProduct.id] ?? {}) };
      return NextResponse.json({ product: productWithOverrides, source: 'static' });
    }

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
    const { getAuthUser } = await import('@/lib/jwt');
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { slug } = await params;
    const data = await req.json();
    const product = await prisma.product.update({ where: { slug }, data });
    return NextResponse.json({ product });
  } catch (err) {
    console.error('[product slug PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
