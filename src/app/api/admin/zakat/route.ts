export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { gregorianToHijri, daysUntilNextDhulHijjah1 } from '@/lib/hijri';

// GET — return the snapshot history newest-first plus the current
// Hijri date and a countdown to 1 Dhul-Hijjah. The page uses these to
// drive the calculator's defaults and the banner.
export async function GET() {
  const guard = await requirePerm('zakat.read');
  if ('response' in guard) return guard.response;

  const today = new Date();
  const hijri = gregorianToHijri(today);
  const daysUntil = daysUntilNextDhulHijjah1(today);

  const snapshots = await prisma.zakatSnapshot.findMany({
    orderBy: { gregorianDate: 'desc' },
    select: {
      id: true, hijriYear: true, hijriDateLabel: true, gregorianDate: true,
      inventoryValuationMethod: true, inventoryValueUsed: true,
      cashOnHand: true, receivables: true, liabilities: true,
      zakatPool: true, zakatAmount: true,
      paymentStatus: true, paymentDate: true, notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    today: {
      gregorian: today.toISOString(),
      hijri,
      daysUntilDhulHijjah1: daysUntil,
    },
    snapshots,
  });
}
