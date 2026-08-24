export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`membership-verify:${ip}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ valid: false, error: 'حاول لاحقاً' }, { status: 429 });

  const membership = await prisma.familyMembership.findUnique({
    where: { qrToken: params.token },
    select: {
      membershipNumber: true,
      status: true,
      tier: true,
      familyName: true,
      memberSince: true,
      expiresAt: true,
      owner: { select: { name: true } },
    },
  });

  if (!membership) return NextResponse.json({ valid: false, error: 'Not found' }, { status: 404 });

  const isCommunity = membership.tier === 'community';
  // Auto-check expiry — community memberships never expire
  const isExpired = !isCommunity && membership.expiresAt && membership.expiresAt < new Date();
  const effectiveStatus = isExpired ? 'EXPIRED' : membership.status;

  // Privacy: show only first name + initial
  const ownerName = membership.owner?.name ?? '';
  const nameParts = ownerName.trim().split(/\s+/);
  const maskedName = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts[1][0]}.`
    : nameParts[0];

  return NextResponse.json({
    valid: effectiveStatus === 'ACTIVE',
    status: effectiveStatus,
    tier: membership.tier ?? 'leader',
    membershipNumber: membership.membershipNumber,
    familyName: membership.familyName,
    ownerName: maskedName,
    memberSince: membership.memberSince,
    expiresAt: isCommunity ? null : membership.expiresAt,
  });
}
