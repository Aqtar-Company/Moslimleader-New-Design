export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getCustomerSupportHistory } from '@/lib/support-system';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const denied = await requirePerm('support-requests.read');
  if (denied) return denied;

  const request = await prisma.supportRequest.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      mlAllocation: { include: { ledgerEntries: { orderBy: { createdAt: 'asc' } } } },
      assignedCopy: {
        include: {
          sponsor: { select: { id: true, name: true, organization: true } },
          events: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });

  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Customer support history
  const history = await getCustomerSupportHistory(request.userId);

  // Available copies for this product
  const availableCopies = await prisma.sponsoredCopy.findMany({
    where: { productId: request.productId, status: 'AVAILABLE' },
    include: { sponsor: { select: { id: true, name: true, organization: true } } },
    orderBy: { purchasedAt: 'asc' },
  });

  return NextResponse.json({ request, history, availableCopies });
}
