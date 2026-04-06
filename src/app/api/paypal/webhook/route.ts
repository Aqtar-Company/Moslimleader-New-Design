export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paypal';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => { headers[key] = value; });

    const isValid = await verifyWebhookSignature(headers, body);
    if (!isValid) {
      console.warn('[paypal webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = event.resource?.id;
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;

      if (orderId) {
        await prisma.order.updateMany({
          where: { paypalOrderId: orderId, status: { not: 'paid' } },
          data: { status: 'paid' },
        });
      }
      console.log(`[paypal webhook] CAPTURE.COMPLETED — capture: ${captureId}, order: ${orderId}`);
    }

    if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        await prisma.order.updateMany({
          where: { paypalOrderId: orderId },
          data: { status: 'payment_failed' },
        });
      }
      console.log(`[paypal webhook] CAPTURE.DENIED — order: ${orderId}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[paypal webhook]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
