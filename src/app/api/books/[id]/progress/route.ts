export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// PUT /api/books/[id]/progress — { lastPage }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { id: bookId } = await params;
    const { lastPage } = await req.json();

    const page = Math.floor(Number(lastPage));
    if (!Number.isFinite(page) || page < 1 || page > 50000) {
      return NextResponse.json({ error: 'رقم الصفحة غير صالح' }, { status: 400 });
    }

    await prisma.bookAccess.updateMany({
      where: { userId: auth.userId, bookId },
      data: { lastPage: page },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[books progress PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
