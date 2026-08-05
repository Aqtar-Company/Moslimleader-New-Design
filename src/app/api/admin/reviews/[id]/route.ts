export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// PATCH /api/admin/reviews/[id] — approve or reject a review
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePerm('reviews.write');
  if ('response' in guard) return guard.response;

  const { approve } = await req.json().catch(() => ({ approve: false }));
  const review = await prisma.review.findUnique({ where: { id: params.id } });
  if (!review) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  await prisma.review.update({ where: { id: params.id }, data: { approved: !!approve } });

  // Update reviewCount on the product
  const count = await prisma.review.count({ where: { productId: review.productId, approved: true } });
  await prisma.product.updateMany({ where: { id: review.productId }, data: { reviewCount: count } });

  await logActionSafe({
    actor: guard.user,
    action: 'review.moderate',
    entity: 'Review',
    entityId: params.id,
    metadata: { approve },
  });

  return NextResponse.json({ ok: true });
}
