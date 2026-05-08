export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

// GET /api/admin/inventory/movements
//   ?productId=...  (optional)
//   ?reason=...     (optional)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  (optional)
//   ?limit=100&offset=0
//
// Returns the StockMovement audit trail. Joined with Product and (when
// orderId is set) the User who placed the order so the UI can display a
// human-readable trail without N+1 queries.
export async function GET(req: NextRequest) {
  const guard = await requirePerm('inventory.read');
  if ('response' in guard) return guard.response;

  const sp = req.nextUrl.searchParams;
  const productId = sp.get('productId') || undefined;
  const reason = sp.get('reason') || undefined;
  const from = sp.get('from');
  const to = sp.get('to');
  const limit = Math.min(Number(sp.get('limit') ?? '100') || 100, 500);
  const offset = Math.max(0, Number(sp.get('offset') ?? '0') || 0);

  const where: Record<string, unknown> = {};
  if (productId) where.productId = productId;
  if (reason) where.reason = reason;
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); range.lte = d; }
    where.createdAt = range;
  }

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, variants: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  // Resolve admin display names in a single batched query so the UI can
  // show "By: <admin name>" without an extra round trip per row.
  const adminIds = Array.from(new Set(rows.map(r => r.adminId).filter((x): x is string => !!x)));
  const admins = adminIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })
    : [];
  const adminMap = new Map(admins.map(a => [a.id, a.email]));

  interface VariantShape { name?: string }
  const movements = rows.map(r => {
    const variants = (r.product.variants as unknown as VariantShape[] | null) ?? [];
    const variantName = r.variantIndex !== null && Array.isArray(variants)
      ? variants[r.variantIndex]?.name ?? `موديل ${r.variantIndex + 1}`
      : null;
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      productId: r.productId,
      productName: r.product.name,
      variantIndex: r.variantIndex,
      variantName,
      delta: r.delta,
      reason: r.reason,
      orderId: r.orderId,
      adminId: r.adminId,
      adminEmail: r.adminId ? adminMap.get(r.adminId) ?? null : null,
      stockBefore: r.stockBefore,
      stockAfter: r.stockAfter,
      variantStockBefore: r.variantStockBefore,
      variantStockAfter: r.variantStockAfter,
      note: r.note,
    };
  });

  return NextResponse.json({ movements, total, limit, offset });
}
