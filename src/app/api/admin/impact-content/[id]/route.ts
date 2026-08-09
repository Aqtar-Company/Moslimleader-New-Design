export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';

// PATCH — approve or reject an impact message or media item
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, decision } = await req.json(); // type: 'message' | 'media', decision: 'APPROVED' | 'REJECTED'

  if (!['message', 'media'].includes(type) || !['APPROVED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  if (type === 'message') {
    await prisma.beneficiaryImpactMessage.update({
      where: { id: params.id },
      data: { status: decision, reviewedByUserId: user.userId, reviewedAt: new Date() },
    });
    await logActionSafe({
      actor: user,
      action: decision === 'APPROVED' ? 'impact-message.approve' : 'impact-message.reject',
      entity: 'BeneficiaryImpactMessage',
      entityId: params.id,
    });
  } else {
    await prisma.beneficiaryImpactMedia.update({
      where: { id: params.id },
      data: { status: decision, reviewedByUserId: user.userId, reviewedAt: new Date() },
    });
    await logActionSafe({
      actor: user,
      action: decision === 'APPROVED' ? 'impact-media.approve' : 'impact-media.reject',
      entity: 'BeneficiaryImpactMedia',
      entityId: params.id,
    });
  }

  return NextResponse.json({ ok: true });
}
