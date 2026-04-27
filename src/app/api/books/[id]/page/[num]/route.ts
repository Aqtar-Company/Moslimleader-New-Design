export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { renderPdfPage } from '@/lib/pdf-renderer';
import { burnWatermark } from '@/lib/watermark';
import { checkRateLimit } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string; num: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: bookId, num } = await params;
    const pageNum = parseInt(num, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return NextResponse.json({ error: 'رقم صفحة غير صحيح' }, { status: 400 });
    }

    const auth = await getAuthUser();

    // ── Rate limiting ────────────────────────────────────────────────────────
    // 20 pages per minute — covers normal reading (~1-3 pages/min) with headroom
    const rateLimitKey = auth
      ? `user:${auth.userId}`
      : `ip:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`;

    const { allowed, retryAfterMs } = checkRateLimit(rateLimitKey, 20, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'طلبات كثيرة جداً، يرجى الانتظار لحظة ثم المتابعة.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
        },
      );
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { filePath: true, isPublished: true, freePages: true },
    });

    if (!book || !book.filePath) {
      return NextResponse.json({ error: 'الكتاب غير موجود' }, { status: 404 });
    }

    if (!book.isPublished && (!auth || auth.role !== 'admin')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // Determine access level
    let hasFullAccess = auth?.role === 'admin';
    if (auth && !hasFullAccess) {
      const access = await prisma.bookAccess.findUnique({
        where: { userId_bookId: { userId: auth.userId, bookId } },
      });
      hasFullAccess = !!access;
    }

    // Enforce free page limit
    const allowed2 = hasFullAccess ? Infinity : book.freePages;
    if (pageNum > allowed2) {
      return NextResponse.json({ error: 'غير مصرح — اشترِ الكتاب للوصول الكامل' }, { status: 403 });
    }

    // Render page (cached clean PNG)
    const pngBuffer = await renderPdfPage(bookId, book.filePath, pageNum);

    // ── Watermark ────────────────────────────────────────────────────────────
    // Burn user identity into the image server-side so leaked screenshots are traceable
    let finalBuffer = pngBuffer;
    if (auth) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true },
      });
      finalBuffer = await burnWatermark(pngBuffer, [
        user?.name ?? '',
        auth.email,
        dateStr,
      ]);
    }

    return new NextResponse(finalBuffer, {
      headers: {
        'Content-Type': 'image/png',
        // No shared cache — each user gets a unique watermarked image
        'Cache-Control': auth ? 'private, no-store' : 'public, max-age=60',
        'X-Has-Access': String(hasFullAccess),
        'X-Free-Pages': String(book.freePages),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('out of range')) {
      return NextResponse.json({ error: 'رقم الصفحة خارج النطاق' }, { status: 404 });
    }
    console.error('[books/:id/page/:num GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
