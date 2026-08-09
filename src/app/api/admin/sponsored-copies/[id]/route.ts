export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import {
  startPreparation,
  markShipped,
  markDelivered,
  completeCopy,
  refundCopy,
} from '@/lib/support-system';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const copy = await prisma.sponsoredCopy.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      sponsor: true,
      sponsoredOrder: true,
      beneficiaryUser: { select: { id: true, name: true, email: true, phone: true } },
      supportRequest: true,
      events: { orderBy: { createdAt: 'asc' } },
      impactMessages: { orderBy: { createdAt: 'desc' } },
      impactMedia: { orderBy: { createdAt: 'desc' } },
      consents: true,
    },
  });

  if (!copy) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ copy });
}

// PATCH — status transitions
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, ...data } = body;

  try {
    switch (action) {
      case 'start_preparation':
        await startPreparation(params.id, user.userId, user.role);
        break;
      case 'mark_shipped':
        await markShipped(params.id, user.userId, user.role, {
          provider: data.provider,
          shipmentId: data.shipmentId,
          trackingNumber: data.trackingNumber,
        });
        break;
      case 'mark_delivered':
        await markDelivered(params.id, user.userId, user.role);
        break;
      case 'complete':
        await completeCopy(params.id, user.userId, user.role);
        break;
      case 'refund':
        await refundCopy(params.id, user.userId, user.role, {
          amount: data.amount,
          reason: data.reason,
          paymentRef: data.paymentRef,
        });
        break;
      default:
        return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
