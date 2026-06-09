export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

const VALID_REASONS = ['defective', 'wrong_item', 'not_as_described', 'other'];
const RETURN_WINDOW_DAYS = 14;

// POST /api/orders/[id]/return — customer requests a return or exchange
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    const { id: orderId } = await params;
    const body = await req.json();
    const { type, reason, reasonNote, items } = body;

    if (!['return', 'exchange'].includes(type)) {
      return NextResponse.json({ error: 'نوع الطلب غير صحيح' }, { status: 400 });
    }
    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'السبب غير صحيح' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'يجب اختيار منتج واحد على الأقل' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    if (order.userId !== auth.userId) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (order.status !== 'delivered') {
      return NextResponse.json({ error: 'لا يمكن طلب إرجاع إلا بعد التسليم' }, { status: 400 });
    }

    // Check return window
    const daysSinceDelivery = (Date.now() - new Date(order.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
      return NextResponse.json({ error: `انتهت مهلة الإرجاع (${RETURN_WINDOW_DAYS} يوم من التسليم)` }, { status: 400 });
    }

    // Check no existing open return request
    const existing = await prisma.returnRequest.findFirst({
      where: { orderId, userId: auth.userId, status: { in: ['pending', 'approved'] } },
    });
    if (existing) {
      return NextResponse.json({ error: 'يوجد طلب إرجاع مفتوح بالفعل لهذا الطلب' }, { status: 409 });
    }

    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        userId: auth.userId,
        type,
        reason,
        reasonNote: reasonNote?.trim() || null,
        itemsJson: items,
        status: 'pending',
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'return_requested' },
    });

    return NextResponse.json({ ok: true, returnRequestId: returnRequest.id }, { status: 201 });
  } catch (err) {
    console.error('[orders/return POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
