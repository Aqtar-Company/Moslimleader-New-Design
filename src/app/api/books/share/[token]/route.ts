export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// POST /api/books/share/[token] — redeem a friend share link
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });

    const { token } = await params;

    const link = await prisma.bookShareLink.findUnique({ where: { token } });

    if (!link) {
      return NextResponse.json({ error: 'الرابط غير صحيح أو منتهي الصلاحية' }, { status: 404 });
    }

    if (link.expiresAt < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية هذا الرابط' }, { status: 410 });
    }

    // Don't grant access to the person who created the link (they already have it)
    if (link.createdBy !== auth.userId) {
      await prisma.$transaction([
        prisma.bookAccess.upsert({
          where: { userId_bookId: { userId: auth.userId, bookId: link.bookId } },
          create: { userId: auth.userId, bookId: link.bookId },
          update: {},
        }),
        prisma.bookShareLink.update({
          where: { id: link.id },
          data: { usedCount: { increment: 1 } },
        }),
      ]);
    }

    return NextResponse.json({ ok: true, bookId: link.bookId });
  } catch (err) {
    console.error('[books share token POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
