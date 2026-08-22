export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULTS = { egyEgp: 100, egyUsd: 2.00, intlUsd: 5.00, instapayNumber: '', leaderDiscountPct: 15, communityDiscountPct: 5 };

export async function GET() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'membership-price-egy-egp',
          'membership-price-egy-usd',
          'membership-price-intl-usd',
          'membership-instapay-number',
          'membership-discount-leader',
          'membership-discount-community',
        ],
      },
    },
  });
  const map = Object.fromEntries(settings.map(s => [s.key, s.value as string]));
  return NextResponse.json({
    egyEgp:               parseInt(map['membership-price-egy-egp']      ?? '', 10) || DEFAULTS.egyEgp,
    egyUsd:               parseFloat(map['membership-price-egy-usd']    ?? '')     || DEFAULTS.egyUsd,
    intlUsd:              parseFloat(map['membership-price-intl-usd']   ?? '')     || DEFAULTS.intlUsd,
    instapayNumber:       (map['membership-instapay-number'] ?? '') || DEFAULTS.instapayNumber,
    leaderDiscountPct:    (() => { const v = parseInt(map['membership-discount-leader']    ?? '', 10); return Number.isNaN(v) ? DEFAULTS.leaderDiscountPct    : v; })(),
    communityDiscountPct: (() => { const v = parseInt(map['membership-discount-community'] ?? '', 10); return Number.isNaN(v) ? DEFAULTS.communityDiscountPct : v; })(),
  });
}
