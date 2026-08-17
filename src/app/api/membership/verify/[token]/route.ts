export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const membership = await prisma.familyMembership.findUnique({
    where: { qrToken: params.token },
    select: {
      membershipNumber: true,
      status: true,
      familyName: true,
      memberSince: true,
      expiresAt: true,
      owner: { select: { name: true } },
    },
  });

  if (!membership) return NextResponse.json({ valid: false, error: 'Not found' }, { status: 404 });

  // Auto-check expiry
  const isExpired = membership.expiresAt && membership.expiresAt < new Date();
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
    membershipNumber: membership.membershipNumber,
    familyName: membership.familyName,
    ownerName: maskedName,
    memberSince: membership.memberSince,
    expiresAt: membership.expiresAt,
  });
}
