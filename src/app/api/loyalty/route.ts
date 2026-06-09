export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/loyalty — get user's loyalty points balance + recent transactions
export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const [user, transactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { loyaltyPoints: true },
      }),
      prisma.loyaltyTransaction.findMany({
        where: { userId: auth.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      points: user?.loyaltyPoints ?? 0,
      egpValue: Math.floor((user?.loyaltyPoints ?? 0) / 10), // 100 points = 10 EGP
      transactions,
    });
  } catch (err) {
    console.error('[loyalty GET]', err);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
