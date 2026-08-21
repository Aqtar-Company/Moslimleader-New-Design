export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

function generateQRToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return 'ML-' + Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function generateMembershipNumber(): Promise<string> {
  const year = String(new Date().getFullYear()).slice(1);
  const latest = await prisma.familyMembership.findFirst({
    where: { membershipNumber: { startsWith: `ML-${year}-` } },
    orderBy: { membershipNumber: 'desc' },
    select: { membershipNumber: true },
  });
  let seq = 1;
  if (latest?.membershipNumber) {
    const parts = latest.membershipNumber.split('-');
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
  }
  return `ML-${year}-${String(seq).padStart(5, '0')}`;
}

// Creates a PENDING membership record for bank/InstaPay transfers — admin activates manually
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = checkRateLimit(`membership-request-manual:${user.userId}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const { familyName } = await req.json().catch(() => ({}));

  const existing = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
  if (existing && existing.status === 'ACTIVE') {
    return NextResponse.json({ error: 'Already an active member' }, { status: 409 });
  }

  if (!existing) {
    const membershipNumber = await generateMembershipNumber();
    let qrToken = generateQRToken();
    while (await prisma.familyMembership.findUnique({ where: { qrToken } })) {
      qrToken = generateQRToken();
    }
    await prisma.familyMembership.create({
      data: {
        ownerUserId: user.userId,
        membershipNumber,
        qrToken,
        familyName: familyName?.trim() || null,
        memberSince: new Date().getFullYear(),
        status: 'PENDING',
      },
    });
  } else {
    await prisma.familyMembership.update({
      where: { id: existing.id },
      data: {
        familyName: familyName?.trim() || existing.familyName,
        status: 'PENDING',
        paypalOrderId: null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
