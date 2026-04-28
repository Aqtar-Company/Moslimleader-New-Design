export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { invalidateAdminProductsCache } from '../route';
import { products as staticProducts } from '@/lib/products';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// GET /api/admin/products/[id] — fetch single product with full data (for edit form)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id } = await params;

    // Try DB product first
    const dbProduct = await prisma.product.findUnique({ where: { id } });
    if (dbProduct) {
      if (dbProduct.source === 'static') {
        const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
        const overrides = ((overrideSetting?.value ?? {}) as Record<string, Record<string, unknown>>)[id] ?? {};
        return NextResponse.json({ product: { ...dbProduct, ...overrides, isAdded: false } });
      }
      return NextResponse.json({ product: { ...dbProduct, isAdded: true } });
    }

    // Fall back to static product + overrides
    const staticProduct = staticProducts.find(p => p.id === id);
    if (!staticProduct) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    }

    const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
    const overrides = ((overrideSetting?.value ?? {}) as Record<string, Record<string, unknown>>)[id] ?? {};

    return NextResponse.json({ product: { ...staticProduct, ...overrides, isAdded: false } });
  } catch (err) {
    console.error('[admin products GET/:id]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// PUT /api/admin/products/[id] — update product (DB product) or save override (static)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { isAdded, regionalPricing, ...data } = body;

    // Convert numeric fields if present
    if (data.price !== undefined) data.price = Number(data.price);
    if (data.priceUsd !== undefined) data.priceUsd = Number(data.priceUsd);
    if (data.weight !== undefined) data.weight = Number(data.weight);

    if (isAdded) {
      // Update DB product
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      invalidateAdminProductsCache();
      return NextResponse.json({ product });
    } else {
      // Save override for static product in Setting table
      const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
      const existing = (overrideSetting?.value ?? {}) as Record<string, Record<string, unknown>>;
      const updated = { ...existing, [id]: { ...(existing[id] ?? {}), ...data } };

      await prisma.setting.upsert({
        where: { key: 'product-overrides' },
        create: { key: 'product-overrides', value: updated as object, updatedAt: new Date() },
        update: { value: updated as object, updatedAt: new Date() },
      });

      // Also update the seeded DB copy if it exists (keeps DB in sync)
      const seededProduct = await prisma.product.findFirst({ where: { id, source: 'static' } });
      if (seededProduct) {
        const dbSafe = { ...data };
        delete dbSafe.id; delete dbSafe.slug; delete dbSafe.source;
        if (dbSafe.images) dbSafe.images = dbSafe.images;
        if (dbSafe.tags) dbSafe.tags = dbSafe.tags;
        if (dbSafe.variants) dbSafe.variants = dbSafe.variants;
        await prisma.product.update({
          where: { id },
          data: { ...dbSafe, updatedAt: new Date() },
        });
      }

      invalidateAdminProductsCache();
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error('[admin products PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id] — delete admin-added product from DB
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id } = await params;

    // Only admin-source products can be deleted
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.source !== 'admin') {
      return NextResponse.json({ error: 'لا يمكن حذف المنتج' }, { status: 400 });
    }

    await prisma.product.delete({ where: { id } });
    invalidateAdminProductsCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin products DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
