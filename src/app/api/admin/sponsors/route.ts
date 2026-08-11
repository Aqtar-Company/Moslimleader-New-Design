export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  const denied = await requirePerm('sponsors.read');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? undefined;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit  = 25;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { organization: { contains: search } },
    ];
  }

  const [total, sponsors] = await Promise.all([
    prisma.sponsor.count({ where }),
    prisma.sponsor.findMany({
      where,
      include: {
        _count: { select: { copies: true, sponsoredOrders: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ sponsors, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const denied = await requirePerm('sponsors.write');
  if (denied) return denied;
  const user = await getAuthUser();

  const body = await req.json();
  const { name, phone, email, organization, notes, userId } = body;

  if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });

  const sponsor = await prisma.sponsor.create({
    data: {
      name,
      phone: phone ?? null,
      email: email ?? null,
      organization: organization ?? null,
      notes: notes ?? null,
      userId: userId ?? null,
      createdByUserId: user.userId,
    },
  });

  await logActionSafe({
    actor: { userId: user.userId, role: user.role },
    action: 'sponsor.create',
    entity: 'Sponsor',
    entityId: sponsor.id,
    after: { name, organization },
  });

  return NextResponse.json({ sponsor }, { status: 201 });
}
