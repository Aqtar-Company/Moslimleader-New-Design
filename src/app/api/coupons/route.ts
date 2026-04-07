export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/coupons — public endpoint, returns only active coupons
// Used by cart/checkout to validate user-entered coupon codes
export async function GET() {
  try {
    const coupons = await prisma.coupon.findMany({
      where: { isActive: true },
      select: { code: true, discount: true },
    });

    return NextResponse.json(
      { coupons },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err) {
    console.error('[public coupons GET]', err);
    return NextResponse.json({ coupons: [] }, { status: 500 });
  }
}
