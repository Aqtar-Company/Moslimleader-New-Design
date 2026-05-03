export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { trackByNumber } from '@/lib/bosta';

// POST /api/admin/shipments/[id]/refresh — re-fetch latest status from Bosta
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
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
