export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { listDeliveries, type BostaListDelivery } from '@/lib/bosta';
import { normalizeEgyptPhone } from '@/lib/phone';

interface ImportProgress {
  type: 'page' | 'log' | 'done' | 'error';
  page?: number;
  pageItems?: number;
  totalSeen?: number;
  imported?: number;
  linked?: number;
  skipped?: number;
  message?: string;
}

function mapBostaStateToOrderStatus(stateValue?: string, stateCode?: number): string {
  const v = (stateValue || '').toLowerCase();
  if (stateCode === 45 || v.includes('delivered')) return 'delivered';
  if (stateCode === 46 || stateCode === 47 || v.includes('returned') || v.includes('cancel')) return 'cancelled';
  if (stateCode && stateCode >= 21 && stateCode < 45) return 'shipped';
  if (v.includes('out for delivery') || v.includes('in transit') || v.includes('picked')) return 'shipped';
  return 'shipped';
}

function bostaToShippingAddress(d: BostaListDelivery) {
  const drop = d.dropOffAddress || {};
  const cityName = (drop.city as { name?: string })?.name || drop.cityName || d.cityName || '';
  const zoneName = (drop.zone as { name?: string })?.name || '';
  const districtName = (drop.district as { name?: string })?.name || '';
  return {
    firstName: d.receiver?.firstName || '',
    lastName: d.receiver?.lastName || '',
    phone: d.receiver?.phone || '',
    whatsappNumber: d.receiver?.secondPhone || '',
    email: d.receiver?.email || '',
    street: drop.firstLine || '',
    building: drop.buildingNumber || '',
    city: districtName || zoneName,
    region: zoneName,
    governorate: cityName,
    country: 'EG',
  };
}

// POST /api/admin/bosta/import-history — pull every Bosta delivery and create
// shadow Customer/Order/Shipment rows so historical receivers appear in
// /admin/customers and /admin/shipments. Idempotent — re-running only adds
// what's missing (keyed by Bosta delivery _id).
export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'غير مصرح' }), { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const maxPages = Math.min(typeof body.maxPages === 'number' ? body.maxPages : 200, 500);
  const pageSize = Math.min(typeof body.pageSize === 'number' ? body.pageSize : 50, 100);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (msg: ImportProgress) => controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'));

      let totalSeen = 0;
      let imported = 0;
      let linked = 0;
      let skipped = 0;

      try {
        for (let page = 1; page <= maxPages; page++) {
          const { items, hasMore } = await listDeliveries(page, pageSize);
          if (items.length === 0) {
            send({ type: 'log', message: `صفحة ${page} فارغة، إيقاف.` });
            break;
          }
          totalSeen += items.length;
          send({ type: 'page', page, pageItems: items.length, totalSeen, imported, linked, skipped });

          for (const d of items) {
            try {
              if (!d._id) { skipped += 1; continue; }

              // 1) Already imported?
              const existingShipment = await prisma.shipment.findFirst({
                where: { bostaDeliveryId: d._id },
              });
              if (existingShipment) {
                skipped += 1;
                continue;
              }

              // 2) businessReference matches one of our Orders?
              if (d.businessReference) {
                const ord = await prisma.order.findUnique({ where: { id: d.businessReference } });
                if (ord) {
                  await prisma.shipment.upsert({
                    where: { orderId: ord.id },
                    create: {
                      orderId: ord.id,
                      provider: 'bosta',
                      bostaDeliveryId: d._id,
                      trackingNumber: d.trackingNumber,
                      status: mapBostaStateToOrderStatus(d.state?.value, d.state?.code) === 'delivered' ? 'delivered' : 'created',
                      state: d.state?.value || null,
                      cod: d.cod ?? 0,
                      rawPayload: d as unknown as object,
                    },
                    update: {
                      bostaDeliveryId: d._id,
                      trackingNumber: d.trackingNumber,
                      state: d.state?.value || null,
                      cod: d.cod ?? 0,
                      rawPayload: d as unknown as object,
                    },
                  });
                  linked += 1;
                  continue;
                }
              }

              // 3) Find/create User by email or phone
              const phone = normalizeEgyptPhone(d.receiver?.phone) || d.receiver?.phone || null;
              const fullName = [d.receiver?.firstName, d.receiver?.lastName].filter(Boolean).join(' ').trim()
                || d.receiver?.fullName
                || 'عميل بوسطة';

              let user = null;
              if (d.receiver?.email) {
                user = await prisma.user.findUnique({ where: { email: d.receiver.email.toLowerCase() } });
              }
              if (!user && phone) {
                user = await prisma.user.findFirst({ where: { phone } });
              }
              if (!user) {
                // Synthetic email when missing — clearly marked so it can never collide.
                const syntheticEmail = d.receiver?.email?.toLowerCase()
                  || (phone ? `bosta-${phone}@imported.local` : `bosta-${d._id}@imported.local`);
                // Random unguessable hash — these accounts can't sign in (would need password reset).
                const placeholderHash = randomBytes(32).toString('hex');
                try {
                  user = await prisma.user.create({
                    data: {
                      name: fullName,
                      email: syntheticEmail,
                      passwordHash: placeholderHash,
                      phone,
                      emailVerified: false,
                      marketingOptIn: false,
                      role: 'customer',
                    },
                  });
                } catch {
                  // Race or unique collision — try one more lookup
                  user = await prisma.user.findUnique({ where: { email: syntheticEmail } });
                  if (!user) {
                    skipped += 1;
                    continue;
                  }
                }
              }

              // 4) Create synthetic Order + Shipment
              const orderStatus = mapBostaStateToOrderStatus(d.state?.value, d.state?.code);
              const createdAt = d.createdAt ? new Date(d.createdAt) : new Date();
              const shippingAddress = bostaToShippingAddress(d);

              const order = await prisma.order.create({
                data: {
                  userId: user.id,
                  status: orderStatus,
                  total: d.cod ?? 0,
                  shippingCost: 0,
                  paymentMethod: 'bosta-historical',
                  shippingAddress: shippingAddress as unknown as object,
                  notes: `Imported from Bosta — tracking ${d.trackingNumber || d._id}`,
                  currency: 'EGP',
                  createdAt,
                },
              });

              await prisma.shipment.create({
                data: {
                  orderId: order.id,
                  provider: 'bosta',
                  bostaDeliveryId: d._id,
                  trackingNumber: d.trackingNumber,
                  status: orderStatus === 'delivered' ? 'delivered' : (orderStatus === 'cancelled' ? 'cancelled' : 'created'),
                  state: d.state?.value || null,
                  cod: d.cod ?? 0,
                  rawPayload: d as unknown as object,
                  createdAt,
                },
              });
              imported += 1;
            } catch (err) {
              const message = err instanceof Error ? err.message : 'unknown';
              send({ type: 'log', message: `❌ ${d._id}: ${message.slice(0, 200)}` });
              skipped += 1;
            }
          }

          send({ type: 'page', page, pageItems: items.length, totalSeen, imported, linked, skipped });

          if (!hasMore || items.length < pageSize) {
            send({ type: 'log', message: `وصلنا لآخر صفحة (${page}).` });
            break;
          }
        }

        send({ type: 'done', totalSeen, imported, linked, skipped });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'فشل الاستيراد';
        send({ type: 'error', message, totalSeen, imported, linked, skipped });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no', // disable nginx buffering so progress streams live
    },
  });
}
