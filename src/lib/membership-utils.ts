import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export function generateQRToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return 'ML-' + Array.from(bytes, (b: number) => chars[b % chars.length]).join('');
}

export async function generateMembershipNumber(): Promise<string> {
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

export async function generateUniqueQRToken(): Promise<string> {
  let qrToken = generateQRToken();
  while (await prisma.familyMembership.findUnique({ where: { qrToken } })) {
    qrToken = generateQRToken();
  }
  return qrToken;
}
