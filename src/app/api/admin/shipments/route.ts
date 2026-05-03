export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          id: true, status: true, total: true, currency: true, paymentMethod: true,
          shippingAddress: true, createdAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json({ shipments });
}
