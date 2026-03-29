export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

// POST /api/books/[id]/share — create a time-limited share link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });

    const { id: bookId } = await params;

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { allowFriendShare: true, friendShareHours: true, isPublished: true },
    });

    if (!book || !book.isPublished) {
      return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });
    }

    if (!book.allowFriendShare) {
      return NextResponse.json({ error: 'المشاركة غير متاحة لهذا الكتاب' }, { status: 403 });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + book.friendShareHours * 60 * 60 * 1000);

    const link = await prisma.bookShareLink.create({
      data: { bookId, createdBy: auth.userId, token, expiresAt },
    });

    return NextResponse.json({ token: link.token, expiresAt: link.expiresAt });
  } catch (err) {
    console.error('[books share POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
