export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateAdminProductsCache } from '@/lib/admin-products-cache';
import { invalidateAssistantContext } from '@/lib/assistant-knowledge';
import { products as staticProducts } from '@/lib/products';
import { loadStaticOverrides, applyOverride, invalidateOverridesCache } from '@/lib/product-overrides';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// GET /api/admin/products/[id] — fetch single product with full data (for edit form)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm(['products.read', 'products.write'] as Permission[]);
    if ('response' in guard) return guard.response;

    const { id } = await params;

    // Try DB product first. Static-sourced rows go through the shared
    // override helper so the edit form sees the same prices the public
    // pages see.
    const dbProduct = await prisma.product.findUnique({ where: { id } });
    if (dbProduct) {
      if (dbProduct.source === 'static') {
        const overrides = await loadStaticOverrides();
        const merged = applyOverride(dbProduct as unknown as import('@/types').Product, overrides[id]);
        if (!merged) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
        return NextResponse.json({ product: { ...merged, isAdded: false } });
      }
      return NextResponse.json({ product: { ...dbProduct, isAdded: true } });
    }

    // Fall back to pure static lookup with overrides applied.
    const staticProduct = staticProducts.find(p => p.id === id);
    if (!staticProduct) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    }
    const overrides = await loadStaticOverrides();
    const merged = applyOverride(staticProduct, overrides[id]);
    if (!merged) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    return NextResponse.json({ product: { ...merged, isAdded: false } });
  } catch (err) {
    console.error('[admin products GET/:id]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// PUT /api/admin/products/[id] — update product (DB product) or save override (static)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm('products.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { id } = await params;
    const body = await req.json();
    const { isAdded, regionalPricing, ...data } = body;

    // Convert numeric fields if present
    if (data.price !== undefined) data.price = Number(data.price);
    if (data.priceUsd !== undefined) data.priceUsd = Number(data.priceUsd);
    if (data.weight !== undefined) data.weight = Number(data.weight);
    // Age targeting — clamp to 0-18 or null. The form sends null
    // explicitly when the admin clicks "كل الأعمار", so we keep
    // that signal as-is.
    const clampAge = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(18, Math.floor(n)));
    };
    if ('minAge' in data) data.minAge = clampAge(data.minAge);
    if ('maxAge' in data) data.maxAge = clampAge(data.maxAge);
    if ('needsParentalGuide' in data) data.needsParentalGuide = !!data.needsParentalGuide;
    if ('images' in data && Array.isArray(data.images)) data.images = data.images.slice(0, 10);

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
      invalidateAssistantContext();
      await logActionSafe({
        actor: auth,
        action: 'product.update',
        entity: 'Product',
        entityId: id,
        after: { name: product.name, price: product.price },
      });
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
        await prisma.product.update({
          where: { id },
          data: { ...dbSafe, updatedAt: new Date() },
        });
      }

      invalidateOverridesCache();
      invalidateAdminProductsCache();
      invalidateAssistantContext();
      await logActionSafe({
        actor: auth,
        action: 'product.update',
        entity: 'Product',
        entityId: id,
        metadata: { kind: 'static-override', fields: Object.keys(data) },
      });
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error('[admin products PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id] — delete product (admin or static)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm('products.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const { id } = await params;

    const product = await prisma.product.findUnique({ where: { id } });

    if (product && product.source === 'admin') {
      await prisma.product.delete({ where: { id } });
    } else {
      // Static product: mark as deleted in overrides
      const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
      const existing = (overrideSetting?.value ?? {}) as Record<string, Record<string, unknown>>;
      const updated = { ...existing, [id]: { ...(existing[id] ?? {}), _deleted: true } };
      await prisma.setting.upsert({
        where: { key: 'product-overrides' },
        create: { key: 'product-overrides', value: updated as object, updatedAt: new Date() },
        update: { value: updated as object, updatedAt: new Date() },
      });
      // Also delete DB seeded copy if exists
      try { await prisma.product.deleteMany({ where: { id, source: 'static' } }); } catch {}
    }

    invalidateAdminProductsCache();
    invalidateAssistantContext();
    await logActionSafe({
      actor: auth,
      action: 'product.delete',
      entity: 'Product',
      entityId: id,
      before: product ? { name: product.name, source: product.source } : null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin products DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
