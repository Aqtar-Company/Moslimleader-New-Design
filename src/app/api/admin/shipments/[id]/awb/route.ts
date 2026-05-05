export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDeliveryAwb } from '@/lib/bosta';
import { requirePerm } from '@/lib/permissions';

// GET /api/admin/shipments/[id]/awb — stream Bosta airway bill PDF (بوليصة)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm('shipments.read');
    if ('response' in guard) return guard.response;
    const { id } = await params;
    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment?.bostaDeliveryId) {
      return NextResponse.json({ error: 'لا توجد شحنة بوسطة لهذا الطلب' }, { status: 404 });
    }
    const awb = await getDeliveryAwb(shipment.bostaDeliveryId);
    if (awb.kind === 'url') {
      return NextResponse.redirect(awb.url, 302);
    }
    const filename = `bosta-${shipment.trackingNumber || shipment.bostaDeliveryId}.pdf`;
    return new NextResponse(new Uint8Array(awb.pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل جلب البوليصة';
    console.error('[bosta awb]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
