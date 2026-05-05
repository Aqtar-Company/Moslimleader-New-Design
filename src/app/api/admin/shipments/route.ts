export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

export async function GET() {
  const guard = await requirePerm('shipments.read');
  if ('response' in guard) return guard.response;

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
