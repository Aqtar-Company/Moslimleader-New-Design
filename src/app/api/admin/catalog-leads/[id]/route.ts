export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const guard = await requirePerm('orders.read');
    if ('response' in guard) return guard.response;

    const body = await req.json();
    const { status, orderId } = body;

    const lead = await prisma.catalogLead.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined && { status: String(status) }),
        ...(orderId !== undefined && { orderId: String(orderId) }),
      },
    });

    return NextResponse.json({ lead });
  } catch (err) {
    console.error('[admin catalog-leads PATCH]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
