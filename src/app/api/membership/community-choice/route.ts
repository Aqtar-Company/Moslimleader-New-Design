export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// POST /api/membership/community-choice
// Called when a user with an expired/cancelled leader membership chooses to stay as community member.
// Sets their membership to ACTIVE with tier="community" and clears expiresAt.
export async function POST() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const membership = await prisma.familyMembership.findUnique({
    where: { ownerUserId: user.userId },
    select: { id: true, status: true, tier: true },
  });

  if (!membership) return NextResponse.json({ error: 'لا توجد عضوية' }, { status: 404 });

  // Only allow community choice for expired or cancelled leader memberships
  const canChoose = (membership.status === 'EXPIRED' || membership.status === 'CANCELLED') && membership.tier === 'leader';
  if (!canChoose) return NextResponse.json({ error: 'غير مسموح' }, { status: 400 });

  const updated = await prisma.familyMembership.update({
    where: { id: membership.id },
    data: {
      status: 'ACTIVE',
      tier: 'community',
      expiresAt: null,
    },
    select: { id: true, status: true, tier: true },
  });

  return NextResponse.json({ ok: true, membership: updated });
}
