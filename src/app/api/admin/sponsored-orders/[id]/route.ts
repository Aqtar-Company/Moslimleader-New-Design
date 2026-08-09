export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createSponsoredCopies } from '@/lib/support-system';
import { logActionSafe } from '@/lib/audit-log';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, paymentRef } = await req.json();

  if (action === 'mark_paid') {
    const order = await prisma.sponsoredOrder.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'already_paid' }, { status: 422 });
    }

    await prisma.sponsoredOrder.update({
      where: { id: params.id },
      data: { paymentStatus: 'paid', paymentRef: paymentRef ?? order.paymentRef },
    });

    const copies = await createSponsoredCopies(params.id, user.userId);

    await logActionSafe({
      actor: { userId: user.userId, role: user.role },
      action: 'sponsored-order.mark-paid',
      entity: 'SponsoredOrder',
      entityId: params.id,
      metadata: { copiesCreated: copies.length },
    });

    return NextResponse.json({ ok: true, copies });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
