export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createDelivery, bostaCityFromGovernorate, bostaCityIdFromGovernorate, normalizeEgyptPhone } from '@/lib/bosta';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

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
    const guard = await requirePerm('shipments.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

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

    // Bosta only delivers within Egypt.
    if (addr.country && addr.country !== 'EG') {
      return NextResponse.json({ error: 'بوسطة يدعم الشحن داخل مصر فقط' }, { status: 400 });
    }
    const govId = addr.governorateId || addr.governorate;
    if (!govId) {
      return NextResponse.json({ error: 'محافظة الشحن مطلوبة' }, { status: 400 });
    }

    const phone = normalizeEgyptPhone(addr.phone);
    if (!phone) {
      return NextResponse.json({ error: 'رقم الهاتف غير صحيح — لازم يكون رقم مصري بصيغة 01xxxxxxxxx' }, { status: 400 });
    }
    const secondPhone = normalizeEgyptPhone(addr.whatsappNumber);

    // Keep the full float — Bosta accepts decimals on COD, no need to lose piasters.
    const cod = order.paymentMethod === 'cod' ? Math.round(order.total * 100) / 100 : 0;
    const itemsCount = order.items.reduce((s, it) => s + it.quantity, 0);
    const description = order.items.map(it => `${it.productName} ×${it.quantity}`).join(' | ').slice(0, 250);

    const fallbackName = (order.user?.name || 'Customer').trim().split(/\s+/);
    const firstName = (addr.firstName || fallbackName[0] || 'Customer').trim();
    const lastName = (addr.lastName || fallbackName.slice(1).join(' ') || '-').trim() || '-';

    const cityId = await bostaCityIdFromGovernorate(govId);

    const delivery = await createDelivery({
      type: 10,
      specs: {
        packageType: 'Parcel',
        packageDetails: { itemsCount, description },
      },
      cod,
      notes: order.notes ?? undefined,
      businessReference: order.id,
      receiver: {
        firstName,
        lastName,
        phone,
        secondPhone: secondPhone && secondPhone !== phone ? secondPhone : undefined,
        email: addr.email || order.user?.email,
      },
      dropOffAddress: {
        cityId: cityId || undefined,
        city: cityId ? undefined : bostaCityFromGovernorate(govId),
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

    await logActionSafe({
      actor: auth,
      action: 'shipment.bosta-create',
      entity: 'Shipment',
      entityId: shipment.id,
      after: {
        orderId: order.id,
        trackingNumber: shipment.trackingNumber,
        cod: shipment.cod,
      },
    });

    return NextResponse.json({ shipment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل إنشاء الشحنة';
    console.error('[bosta create]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
