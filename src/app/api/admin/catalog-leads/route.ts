export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, type Permission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePerm(['orders.read', 'products.read'] as Permission[]);
    if ('response' in guard) return guard.response;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0);
    const status = searchParams.get('status') ?? undefined;

    const where = status ? { status } : {};
    const [leads, total] = await Promise.all([
      prisma.catalogLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.catalogLead.count({ where }),
    ]);

    return NextResponse.json({ leads, total });
  } catch (err) {
    console.error('[admin catalog-leads GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requirePerm('orders.write');
    if ('response' in guard) return guard.response;

    const { id, status, orderId } = await req.json();
    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 });

    const lead = await prisma.catalogLead.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(orderId !== undefined && { orderId }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ lead });
  } catch (err) {
    console.error('[admin catalog-leads PATCH]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
