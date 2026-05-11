export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePerm('orders.read');
    if ('response' in guard) return guard.response;

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

    const where = status ? { status } : {};

    const [leads, total] = await Promise.all([
      prisma.catalogLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.catalogLead.count({ where }),
    ]);

    return NextResponse.json({ leads, total });
  } catch (err) {
    console.error('[admin catalog-leads GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
