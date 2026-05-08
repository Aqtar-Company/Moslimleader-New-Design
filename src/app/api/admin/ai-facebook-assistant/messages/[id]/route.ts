import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/ai-facebook-assistant/messages/[id]
// Update message aiReply text or status (ignored / escalated).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const allowedStatuses = ['draft', 'sent', 'escalated', 'ignored', 'failed'];

  const updateData: Record<string, unknown> = {};
  if (typeof body.aiReply === 'string') updateData.aiReply = body.aiReply;
  if (typeof body.status === 'string' && allowedStatuses.includes(body.status)) {
    updateData.status = body.status;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const message = await prisma.facebookMessage.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json({ message });
}
