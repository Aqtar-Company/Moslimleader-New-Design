import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/tareeq/users/search?q=... — search users by name (for adding to groups etc.)
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      id: { not: user.userId },
      name: { contains: q },
    },
    select: { id: true, name: true, avatarUrl: true },
    take: 8,
  });

  return NextResponse.json({ users });
}
