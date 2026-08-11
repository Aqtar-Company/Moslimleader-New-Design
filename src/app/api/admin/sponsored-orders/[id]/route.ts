export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createSponsoredCopies } from '@/lib/support-system';
import { logActionSafe } from '@/lib/audit-log';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requirePerm('sponsors.write');
  if (denied) return denied;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { action, paymentRef, reason } = await req.json();

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

  if (action === 'cancel') {
    // Cancel a pending order (admin entry mistake or donor request)
    const order = await prisma.sponsoredOrder.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (order.paymentStatus !== 'pending') {
      return NextResponse.json({ error: 'only_pending_can_be_cancelled' }, { status: 422 });
    }

    await prisma.sponsoredOrder.update({
      where: { id: params.id },
      data: { paymentStatus: 'failed', adminNote: reason ? `ملغى: ${reason}` : 'ملغى' },
    });

    await logActionSafe({
      actor: { userId: user.userId, role: user.role },
      action: 'sponsored-order.cancel',
      entity: 'SponsoredOrder',
      entityId: params.id,
      metadata: { reason },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'refund') {
    // Undo a paid order: cancel all AVAILABLE copies and mark as refunded
    const order = await prisma.sponsoredOrder.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (order.paymentStatus !== 'paid') {
      return NextResponse.json({ error: 'only_paid_can_be_refunded' }, { status: 422 });
    }

    // Check if any copies are already assigned to beneficiaries
    const assignedCount = await prisma.sponsoredCopy.count({
      where: {
        sponsoredOrderId: params.id,
        status: { notIn: ['AVAILABLE', 'CANCELLED'] },
      },
    });

    if (assignedCount > 0) {
      return NextResponse.json(
        { error: `لا يمكن التراجع — ${assignedCount} نسخة مخصصة بالفعل لمستفيدين` },
        { status: 422 },
      );
    }

    await prisma.$transaction(async tx => {
      // Cancel only AVAILABLE copies (not already-assigned ones)
      await tx.sponsoredCopy.updateMany({
        where: { sponsoredOrderId: params.id, status: 'AVAILABLE' },
        data: { status: 'CANCELLED' },
      });
      await tx.sponsoredOrder.update({
        where: { id: params.id },
        data: { paymentStatus: 'refunded', adminNote: reason ? `مُسترد: ${reason}` : 'مُسترد' },
      });
    });

    await logActionSafe({
      actor: { userId: user.userId, role: user.role },
      action: 'sponsored-order.refund',
      entity: 'SponsoredOrder',
      entityId: params.id,
      metadata: { reason },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
