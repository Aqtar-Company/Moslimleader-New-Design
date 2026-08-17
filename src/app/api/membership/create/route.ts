export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder } from '@/lib/paypal';

const MEMBERSHIP_PRICE_USD = 2.00; // 100 EGP ÷ 50

function generateQRToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return 'ML-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateMembershipNumber(): Promise<string> {
  const count = await prisma.familyMembership.count();
  const year = String(new Date().getFullYear()).slice(1); // "026" for 2026
  const seq = String(count + 1).padStart(5, '0');
  return `ML-${year}-${seq}`;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { familyName } = await req.json().catch(() => ({}));

  // If already has active membership, deny
  const existing = await prisma.familyMembership.findUnique({ where: { ownerUserId: user.userId } });
  if (existing && existing.status === 'ACTIVE') {
    return NextResponse.json({ error: 'Already an active member' }, { status: 409 });
  }

  const paypalOrderId = await createPayPalOrder(MEMBERSHIP_PRICE_USD, 'Moslim Leader Family Membership');

  if (!existing) {
    // Create pending membership record
    const membershipNumber = await generateMembershipNumber();
    let qrToken = generateQRToken();
    // Ensure QR token uniqueness
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
        paypalOrderId,
      },
    });
  } else {
    // Update existing (expired/cancelled) with new paypal order
    await prisma.familyMembership.update({
      where: { id: existing.id },
      data: {
        familyName: familyName?.trim() || existing.familyName,
        paypalOrderId,
        status: 'PENDING',
      },
    });
  }

  return NextResponse.json({ paypalOrderId });
}
