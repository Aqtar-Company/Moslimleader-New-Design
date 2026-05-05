export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

interface VariantShape { id?: string; name?: string; nameEn?: string; imageIndex?: number }

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const products = await prisma.product.findMany({
    select: {
      id: true, slug: true, name: true, price: true, priceUsd: true,
      images: true, inStock: true, stock: true, category: true,
      variants: true, variantStocks: true, source: true,
    },
    orderBy: { name: 'asc' },
  });

  // For static products whose DB row predates the variants field being added
  // upstream, fall back to the static definition so the inventory UI can still
  // split the models. New static variants flow in lazily without a migration.
  for (const p of products) {
    const variants = (p.variants ?? []) as unknown as VariantShape[];
    if (p.source === 'static' && (!Array.isArray(variants) || variants.length === 0)) {
      const sp = staticProducts.find(s => s.id === p.id || s.slug === p.slug);
      if (sp?.variants && sp.variants.length > 0) {
        (p as { variants: unknown }).variants = sp.variants as unknown;
      }
    }
  }

  // Aggregate sold-counts per (productId, selectedModel) so the inventory page
  // can show real demand per variant alongside available stock.
  const soldRows = await prisma.orderItem.groupBy({
    by: ['productId', 'selectedModel'],
    where: { order: { status: { not: 'cancelled' } } },
    _sum: { quantity: true },
  });
  const soldTotal = new Map<string, number>();
  const soldByVariant = new Map<string, Record<string, number>>();
  for (const r of soldRows) {
    const q = Number(r._sum.quantity ?? 0);
    soldTotal.set(r.productId, (soldTotal.get(r.productId) ?? 0) + q);
    if (r.selectedModel !== null && r.selectedModel !== undefined) {
      const m = soldByVariant.get(r.productId) ?? {};
      m[String(r.selectedModel)] = (m[String(r.selectedModel)] ?? 0) + q;
      soldByVariant.set(r.productId, m);
    }
  }

  return NextResponse.json({
    products: products.map(p => ({
      ...p,
      variants: (p.variants ?? []) as unknown as VariantShape[],
      variantStocks: (p.variantStocks ?? null) as Record<string, number> | null,
      sold: soldTotal.get(p.id) ?? 0,
      soldByVariant: soldByVariant.get(p.id) ?? {},
    })),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const body = await req.json() as {
    productId: string;
    stock?: number;
    delta?: number;
    inStock?: boolean;
    variantIndex?: number;        // present → update only that variant's count
  };
  if (!body.productId) return NextResponse.json({ error: 'productId مطلوب' }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: { stock: true, variantStocks: true, variants: true, source: true, slug: true },
  });
  if (!product) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });

  const data: { stock?: number; inStock?: boolean; variantStocks?: object; variants?: object } = {};
  let variants = (product.variants ?? []) as unknown as VariantShape[];
  // Lazy-import static variants for static products whose DB row hasn't caught up.
  if (product.source === 'static' && (!Array.isArray(variants) || variants.length === 0)) {
    const sp = staticProducts.find(s => s.id === body.productId || s.slug === product.slug);
    if (sp?.variants && sp.variants.length > 0) {
      variants = sp.variants as unknown as VariantShape[];
      data.variants = variants as unknown as object;
    }
  }
  const hasVariants = Array.isArray(variants) && variants.length > 0;

  if (typeof body.variantIndex === 'number' && hasVariants) {
    if (body.variantIndex < 0 || body.variantIndex >= variants.length) {
      return NextResponse.json({ error: 'موديل غير موجود' }, { status: 400 });
    }
    const current = (product.variantStocks ?? {}) as Record<string, number>;
    const key = String(body.variantIndex);
    let nextValue = current[key] ?? 0;
    if (typeof body.stock === 'number') nextValue = Math.max(0, Math.floor(body.stock));
    else if (typeof body.delta === 'number') nextValue = Math.max(0, nextValue + Math.floor(body.delta));
    const nextMap: Record<string, number> = { ...current, [key]: nextValue };
    // Total stock = sum of variants — keeps the headline `stock` figure honest.
    const totalStock = Object.values(nextMap).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
    data.variantStocks = nextMap;
    data.stock = totalStock;
  } else if (hasVariants && (typeof body.stock === 'number' || typeof body.delta === 'number')) {
    // Variant products MUST be edited per model; aggregate edits would
    // desync `stock` from `sum(variantStocks)`.
    return NextResponse.json({
      error: 'هذا المنتج له موديلات — حدّث المخزون من شاشة الموديلات',
    }, { status: 400 });
  } else {
    if (typeof body.stock === 'number') data.stock = Math.max(0, Math.floor(body.stock));
    else if (typeof body.delta === 'number') {
      data.stock = Math.max(0, (product.stock ?? 0) + Math.floor(body.delta));
    }
  }
  if (typeof body.inStock === 'boolean') data.inStock = body.inStock;

  // Update + audit log inside one transaction. Computes the delta from
  // before/after so manual sets ("stock=42") are logged with the right
  // sign and absolute change.
  const updated = await prisma.$transaction(async tx => {
    const next = await tx.product.update({
      where: { id: body.productId },
      data,
      select: {
        id: true, slug: true, name: true, price: true, priceUsd: true, images: true,
        inStock: true, stock: true, category: true, variants: true, variantStocks: true,
      },
    });

    // Log movement only when stock or a variant stock actually changed.
    const stockBefore = product.stock ?? 0;
    const stockAfter = next.stock;
    if (typeof body.variantIndex === 'number' && hasVariants) {
      const beforeMap = (product.variantStocks ?? {}) as Record<string, number>;
      const afterMap = (next.variantStocks ?? {}) as Record<string, number>;
      const key = String(body.variantIndex);
      const variantBefore = beforeMap[key] ?? 0;
      const variantAfter = afterMap[key] ?? 0;
      const delta = variantAfter - variantBefore;
      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: body.productId,
            variantIndex: body.variantIndex,
            delta,
            reason: 'manual_adjustment',
            adminId: auth.userId,
            stockBefore,
            stockAfter,
            variantStockBefore: variantBefore,
            variantStockAfter: variantAfter,
          },
        });
      }
    } else {
      const delta = stockAfter - stockBefore;
      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: body.productId,
            variantIndex: null,
            delta,
            reason: 'manual_adjustment',
            adminId: auth.userId,
            stockBefore,
            stockAfter,
            variantStockBefore: null,
            variantStockAfter: null,
          },
        });
      }
    }
    return next;
  });

  return NextResponse.json({ product: updated });
}
