export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.familyMembership.findUnique({
    where: { ownerUserId: user.userId },
    include: { familyMembers: { orderBy: { createdAt: 'asc' } } },
  });
  if (!membership) return NextResponse.json({ error: 'No membership' }, { status: 404 });

  return NextResponse.json({ familyMembers: membership.familyMembers });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.familyMembership.findUnique({
    where: { ownerUserId: user.userId },
    include: { _count: { select: { familyMembers: true } } },
  });
  if (!membership || membership.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Active membership required' }, { status: 403 });
  }
  if (membership._count.familyMembers >= 5) {
    return NextResponse.json({ error: 'Maximum 5 family members' }, { status: 400 });
  }

  const { name, relation, birthdate } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const member = await prisma.familyMember.create({
    data: {
      membershipId: membership.id,
      name: name.trim(),
      relation: relation || null,
      birthdate: birthdate || null,
    },
  });

  return NextResponse.json({ member });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const membership = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
  if (!membership) return NextResponse.json({ error: 'No membership' }, { status: 404 });

  await prisma.familyMember.deleteMany({ where: { id, membershipId: membership.id } });
  return NextResponse.json({ ok: true });
}
