export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { invalidateAdminProductsCache } from '@/lib/admin-products-cache';
import { invalidateAssistantContext } from '@/lib/assistant-knowledge';
import { PRODUCT_ORDER_KEY, invalidateProductOrderCache, loadProductOrder } from '@/lib/product-overrides';

// GET /api/admin/products/order — the stored id list (empty = natural order).
export async function GET() {
  const guard = await requirePerm(['products.read', 'products.write'] as Permission[]);
  if ('response' in guard) return guard.response;
  return NextResponse.json({ order: await loadProductOrder() });
}

// PUT /api/admin/products/order — { order: string[] } — the whole list, in display order.
//
// The WHOLE list every time, not a "move id X to position N" delta: the admin page holds
// the full order on screen, two admins editing at once is not a case this shop has, and a
// full list cannot drift out of step with itself the way a sequence of deltas can.
export async function PUT(req: NextRequest) {
  const guard = await requirePerm('products.write');
  if ('response' in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const raw: unknown = body?.order;
  if (!Array.isArray(raw) || raw.length > 2000) {
    return NextResponse.json({ error: 'order مطلوب كمصفوفة معرّفات' }, { status: 400 });
  }
  // Strings only, de-duplicated, first occurrence wins.
  const order = [...new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 120))];

  await prisma.setting.upsert({
    where: { key: PRODUCT_ORDER_KEY },
    update: { value: order },
    create: { key: PRODUCT_ORDER_KEY, value: order },
  });

  invalidateProductOrderCache();
  invalidateAdminProductsCache();
  invalidateAssistantContext();
  await logActionSafe({
    actor: guard.user,
    action: 'product.reorder',
    entity: 'Setting',
    entityId: PRODUCT_ORDER_KEY,
    after: { count: order.length, first: order.slice(0, 5) },
  });

  return NextResponse.json({ ok: true, order });
}
