export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/support-requests/:id — beneficiary views request status
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const request = await prisma.supportRequest.findUnique({
    where: { id: params.id },
    include: {
      product: { select: { id: true, name: true, nameEn: true, images: true, slug: true } },
      mlAllocation: { select: { supportAmount: true, customerPayAmount: true, status: true, orderId: true } },
      assignedCopy: {
        select: {
          code: true,
          status: true,
          trackingNumber: true,
          shippingProvider: true,
          shippedAt: true,
          deliveredAt: true,
          beneficiaryConfirmedAt: true,
        },
      },
    },
  });

  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (request.userId !== user.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  return NextResponse.json({ request });
}

// DELETE /api/support-requests/:id — cancel own request
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const request = await prisma.supportRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (request.userId !== user.userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const cancellable = ['PENDING', 'UNDER_REVIEW'];
  if (!cancellable.includes(request.status)) {
    return NextResponse.json({ error: 'cannot_cancel' }, { status: 422 });
  }

  await prisma.supportRequest.update({
    where: { id: params.id },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({ ok: true });
}
