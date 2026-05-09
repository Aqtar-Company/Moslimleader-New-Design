export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { getShipping } from '@/lib/shipping';

// Create an Order from a Facebook conversation. Triggered when the
// admin clicks "📦 إنشاء طلب" on a HOT (or extracted-phone) thread.
//
// Flow:
//   1. Find-or-create a customer User by phone (canonical key for
//      Egyptian SME — most buyers don't have an account).
//   2. Build OrderItems from the requested productIds + quantities,
//      using current product prices (server-side, NOT what the
//      browser sent).
//   3. Compute shippingCost from the governorate.
//   4. Create the Order with source='fb-assistant' and paymentMethod
//      = 'cod' so it joins the regular ops flow.
//   5. Log a manual outgoing FacebookEvent so the conversation
//      thread visually shows the action ("✅ تم إنشاء الطلب #...").

interface ItemInput { productId?: string; quantity?: number }

interface CreateOrderInput {
  psid?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  governorate?: string;
  notes?: string;
  items?: ItemInput[];
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm('orders.write');
  if ('response' in guard) return guard.response;

  let body: CreateOrderInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  // ── Validation ──
  const psid = body.psid?.trim();
  const name = body.name?.trim();
  const phone = body.phone?.replace(/\s+/g, '').trim();
  const address = body.address?.trim();
  const governorate = body.governorate?.trim();
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter(it => it && typeof it.productId === 'string' && it.productId.trim())
    .map(it => ({
      productId: it.productId!.trim(),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(it.quantity) || 1))),
    }));

  if (!psid)        return NextResponse.json({ error: 'psid مطلوب' }, { status: 400 });
  if (!name)        return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
  if (!phone)       return NextResponse.json({ error: 'الموبايل مطلوب' }, { status: 400 });
  if (!address)     return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });
  if (!governorate) return NextResponse.json({ error: 'المحافظة مطلوبة' }, { status: 400 });
  if (items.length === 0) {
    return NextResponse.json({ error: 'لازم منتج واحد على الأقل' }, { status: 400 });
  }

  // ── Find-or-create customer by phone ──
  // Phone is the only stable identifier for FB-sourced customers
  // (they often don't have an email account on the site).
  // We synthesise an email if needed since the User model requires it.
  let customer = await prisma.user.findFirst({
    where: { phone, role: 'customer' },
  });
  if (!customer) {
    const synthEmail = `fb-${phone}@moslimleader.local`;
    const placeholderPwHash = await bcrypt.hash(`fb-${psid}-${Date.now()}`, 10);
    customer = await prisma.user.create({
      data: {
        name,
        email: synthEmail,
        phone,
        passwordHash: placeholderPwHash,
        role: 'customer',
        emailVerified: false,
      },
    });
  } else {
    // Refresh stored name if the bot extracted a fuller version.
    if (name && customer.name !== name) {
      await prisma.user.update({ where: { id: customer.id }, data: { name } });
    }
  }

  // ── Resolve products + prices (server-side, ignore client) ──
  const productIds = items.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, price: true },
  });
  const productMap = new Map(products.map(p => [p.id, p]));
  const missing = items.filter(it => !productMap.has(it.productId));
  if (missing.length > 0) {
    return NextResponse.json({
      error: `منتج غير موجود: ${missing.map(m => m.productId).join(', ')}`,
    }, { status: 400 });
  }

  const orderItemsData = items.map(it => {
    const p = productMap.get(it.productId)!;
    return {
      productId: p.id,
      productName: p.name,
      quantity: it.quantity,
      unitPrice: p.price,
    };
  });
  const subtotal = orderItemsData.reduce(
    (s, oi) => s + oi.unitPrice * oi.quantity,
    0,
  );
  const shippingCost = getShipping(governorate);
  const total = Math.round((subtotal + shippingCost) * 100) / 100;

  // ── Create Order + items in one transaction ──
  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      status: 'pending',
      paymentMethod: 'cod',
      total,
      shippingCost,
      currency: 'EGP',
      source: 'fb-assistant',
      createdByUserId: guard.user.userId,
      shippingAddress: {
        name,
        phone,
        address,
        governorate,
      },
      notes: [`أنشئ من محادثة فيسبوك psid=${psid}`, body.notes?.trim()]
        .filter(Boolean)
        .join(' — '),
      items: { create: orderItemsData },
    },
    include: { items: true },
  });

  // Log a visible "outgoing-manual" entry in the FB conversation so
  // the thread shows the action took place. Doesn't actually send a
  // message to the user — that's a separate "send confirmation"
  // button we can add later.
  await prisma.facebookEvent.create({
    data: {
      psid,
      kind: 'message',
      direction: 'outgoing-manual',
      text: `✅ تم إنشاء الطلب #${order.id.slice(-8)} (${order.items.length} منتج، إجمالي ${Math.round(order.total)} ج.م).`,
      sendStatus: 'sent',
      customerName: name,
      customerPhone: phone,
      customerAddress: address,
      customerGov: governorate,
    },
  }).catch(() => {/* non-fatal */});

  await logActionSafe({
    actor: guard.user,
    action: 'order.create-manual',
    entity: 'Order',
    entityId: order.id,
    after: order,
    metadata: { source: 'fb-assistant', psid },
  });

  return NextResponse.json({ ok: true, orderId: order.id, total: order.total });
}
