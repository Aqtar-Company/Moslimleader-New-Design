export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

// GET /api/admin/notify-requests
// Returns all notify requests grouped by product, newest first.
export async function GET() {
  try {
    const guard = await requirePerm('products.read');
    if ('response' in guard) return guard.response;

    const requests = await prisma.notifyRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, slug: true, images: true } },
      },
    });

    return NextResponse.json({ requests });
  } catch (err) {
    console.error('[admin notify-requests GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
