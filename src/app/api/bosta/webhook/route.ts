export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/bosta';

// Bosta delivery state codes → our internal order status.
// Refs: https://docs.bosta.co
function mapStateToOrderStatus(stateValue?: string, stateCode?: number): string | null {
  const v = (stateValue || '').toLowerCase();
  if (stateCode === 45 || v.includes('delivered')) return 'delivered';
  if (stateCode === 46 || stateCode === 47 || v.includes('returned') || v.includes('canceled') || v.includes('cancelled')) return 'cancelled';
  if (stateCode && stateCode >= 21 && stateCode < 45) return 'shipped';
  if (v.includes('out for delivery') || v.includes('in transit') || v.includes('picked')) return 'shipped';
  return null;
}

interface BostaWebhookPayload {
  event?: string;
  type?: string;
  data?: {
    _id?: string;
    deliveryId?: string;
    trackingNumber?: string;
    businessReference?: string;
    state?: { value?: string; code?: number };
    masterAWB?: string;
  };
  // Some webhooks send fields at top level
  _id?: string;
  trackingNumber?: string;
  state?: { value?: string; code?: number };
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('x-bosta-signature') || req.headers.get('x-signature');

  const ok = await verifyWebhookSignature(raw, signature);
  if (!ok) {
    console.warn('[bosta webhook] invalid signature');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: BostaWebhookPayload;
  try { payload = JSON.parse(raw); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const data = payload.data || payload;
  const deliveryId = data._id || (data as { deliveryId?: string }).deliveryId;
  const trackingNumber = data.trackingNumber;
  const stateValue = data.state?.value;
  const stateCode = data.state?.code;
  const businessReference = (data as { businessReference?: string }).businessReference;

  if (!deliveryId && !trackingNumber && !businessReference) {
    return NextResponse.json({ error: 'missing identifiers' }, { status: 400 });
  }

  const orConditions = [
    deliveryId ? { bostaDeliveryId: deliveryId } : null,
    trackingNumber ? { trackingNumber } : null,
    businessReference ? { orderId: businessReference } : null,
  ].filter((c): c is { bostaDeliveryId: string } | { trackingNumber: string } | { orderId: string } => c !== null);

  const shipment = await prisma.shipment.findFirst({ where: { OR: orConditions } });

  if (!shipment) {
    console.warn('[bosta webhook] no matching shipment', { deliveryId, trackingNumber, businessReference });
    return NextResponse.json({ ok: true, matched: false });
  }

  const prevHistory = Array.isArray(shipment.history) ? (shipment.history as unknown[]) : [];
  const historyEntry = {
    at: new Date().toISOString(),
    event: payload.event || payload.type || 'update',
    state: stateValue,
    code: stateCode,
  };

  const newOrderStatus = mapStateToOrderStatus(stateValue, stateCode);

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      state: stateValue ?? shipment.state,
      status: newOrderStatus || shipment.status,
      history: [...prevHistory, historyEntry] as unknown as object,
      rawPayload: data as unknown as object,
    },
  });

  if (newOrderStatus) {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: newOrderStatus },
    });
  }

  return NextResponse.json({ ok: true });
}
