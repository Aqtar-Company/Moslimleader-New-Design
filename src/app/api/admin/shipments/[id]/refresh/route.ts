export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trackByNumber } from '@/lib/bosta';
import { requirePerm } from '@/lib/permissions';

// POST /api/admin/shipments/[id]/refresh — re-fetch latest status from Bosta.
// Intentionally NOT audit-logged: this is a polling operation (the user
// just clicked "refresh" to see the latest tracking state). Logging it
// would flood the recent-activity widget without surfacing real changes.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePerm('shipments.read');
    if ('response' in guard) return guard.response;
    const { id } = await params;
    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment?.trackingNumber) return NextResponse.json({ error: 'لا يوجد رقم تتبع' }, { status: 404 });

    const tracking = await trackByNumber(shipment.trackingNumber);
    const stateValue = tracking.CurrentStatus?.state ?? tracking.state?.value ?? shipment.state;
    const updated = await prisma.shipment.update({
      where: { id },
      data: {
        state: stateValue,
        rawPayload: tracking as unknown as object,
      },
    });
    return NextResponse.json({ shipment: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل التحديث';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
