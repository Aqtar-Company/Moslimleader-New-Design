export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { cancelDelivery } from '@/lib/bosta';

// POST /api/admin/shipments/[id]/cancel — cancel the Bosta shipment only
// (the order itself stays untouched, so admin can reship via another courier).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    const { id } = await params;
    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment?.bostaDeliveryId) {
      return NextResponse.json({ error: 'لا توجد شحنة بوسطة' }, { status: 404 });
    }
    if (shipment.status === 'cancelled') {
      return NextResponse.json({ error: 'الشحنة ملغاة بالفعل' }, { status: 400 });
    }

    try {
      await cancelDelivery(shipment.bostaDeliveryId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل إلغاء الشحنة من بوسطة';
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const prevHistory = Array.isArray(shipment.history) ? (shipment.history as unknown[]) : [];
    const updated = await prisma.shipment.update({
      where: { id },
      data: {
        status: 'cancelled',
        history: [...prevHistory, { at: new Date().toISOString(), event: 'admin_cancelled_bosta_only' }] as unknown as object,
      },
    });

    // Bring the order back to "pending" so admin can ship it via another courier.
    if (shipment.orderId) {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: 'pending' },
      });
    }

    return NextResponse.json({ shipment: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
