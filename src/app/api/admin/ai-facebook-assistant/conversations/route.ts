import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/admin/ai-facebook-assistant/conversations
// Returns conversations with their latest incoming message and AI draft.
// Optional ?status=draft|sent|escalated|ignored|failed to filter.
export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const take = 50;
  const skip = (page - 1) * take;

  const where = statusFilter
    ? { messages: { some: { status: statusFilter } } }
    : undefined;

  const conversations = await prisma.facebookConversation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    skip,
    take,
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return NextResponse.json({ conversations });
}
