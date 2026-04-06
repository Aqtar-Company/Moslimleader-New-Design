export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { invalidateAdminProductsCache } from '../route';


async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
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
