export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET — list pending impact messages and media for moderation
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'PENDING_REVIEW';

  const [messages, media] = await Promise.all([
    prisma.beneficiaryImpactMessage.findMany({
      where: { status },
      include: {
        copy: {
          select: {
            id: true, code: true,
            product: { select: { id: true, name: true } },
            sponsor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.beneficiaryImpactMedia.findMany({
      where: { status },
      include: {
        copy: {
          select: {
            id: true, code: true,
            product: { select: { id: true, name: true } },
            sponsor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return NextResponse.json({ messages, media });
}
