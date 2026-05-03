export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createDelivery, bostaCityFromGovernorate } from '@/lib/bosta';

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  city?: string;
  region?: string;
  governorate?: string;
  governorateId?: string;
  country?: string;
  notes?: string;
}

// POST /api/admin/orders/[id]/bosta — create a Bosta shipment for the order
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, shipment: true, user: true },
    });
    if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    if (order.shipment?.bostaDeliveryId) {
      return NextResponse.json({ error: 'تم إنشاء شحنة بوسطة لهذا الطلب من قبل', shipment: order.shipment }, { status: 400 });
    }

    const addr = (order.shippingAddress as unknown as ShippingAddress) || {};
    const cod = order.paymentMethod === 'cod' ? Math.round(order.total) : 0;
    const itemsCount = order.items.reduce((s, it) => s + it.quantity, 0);
    const description = order.items.map(it => `${it.productName} ×${it.quantity}`).join(' | ').slice(0, 250);

    const phone = (addr.phone || '').replace(/\s+/g, '');
    const fallbackName = (order.user?.name || 'Customer').trim().split(/\s+/);
    const firstName = (addr.firstName || fallbackName[0] || 'Customer').trim();
    const lastName = (addr.lastName || fallbackName.slice(1).join(' ') || '-').trim() || '-';

    if (!phone) {
      return NextResponse.json({ error: 'رقم الهاتف مطلوب لإنشاء شحنة بوسطة' }, { status: 400 });
    }

    const delivery = await createDelivery({
      type: 10,
      specs: {
        packageType: 'Parcel',
        size: 'Normal',
        packageDetails: { itemsCount, description },
      },
      cod,
      notes: order.notes ?? undefined,
      businessReference: order.id,
      receiver: {
        firstName,
        lastName,
        phone,
        secondPhone: addr.whatsappNumber && addr.whatsappNumber !== addr.phone ? addr.whatsappNumber : undefined,
        email: addr.email || order.user?.email,
      },
      dropOffAddress: {
        city: bostaCityFromGovernorate(addr.governorateId || addr.governorate),
        zone: addr.region || undefined,
        district: addr.city || undefined,
        firstLine: addr.street || '-',
        buildingNumber: addr.building || undefined,
        floor: addr.floor || undefined,
        apartment: addr.apartment || undefined,
      },
    });

    const shipment = await prisma.shipment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: 'bosta',
        bostaDeliveryId: delivery._id,
        trackingNumber: delivery.trackingNumber,
        status: 'created',
        state: delivery.state?.value ?? null,
        cod,
        rawPayload: delivery as unknown as object,
      },
      update: {
        bostaDeliveryId: delivery._id,
        trackingNumber: delivery.trackingNumber,
        status: 'created',
        state: delivery.state?.value ?? null,
        cod,
        rawPayload: delivery as unknown as object,
      },
    });

    // Reflect on the order itself.
    if (order.status === 'pending' || order.status === 'paid') {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'shipped' } });
    }

    return NextResponse.json({ shipment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل إنشاء الشحنة';
    console.error('[bosta create]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
