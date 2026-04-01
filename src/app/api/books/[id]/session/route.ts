export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

// POST /api/books/[id]/session — start or ping a reading session
// Returns { conflict: true } if another session from different IP is active
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ ok: true }); // not logged in, skip

    const { id: bookId } = await params;
    const ip = req.headers.get('cf-connecting-ip') ||
               req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || 'unknown';

    const ACTIVE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes = active session
    const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);

    // Find any active session for this user+book from a DIFFERENT IP
    const conflictSession = await prisma.bookSession.findFirst({
      where: {
        userId: auth.userId,
        bookId,
        lastPing: { gte: cutoff },
        ipAddress: { not: ip },
      },
    });

    if (conflictSession) {
      return NextResponse.json({
        conflict: true,
        message: 'يبدو أن حسابك مفتوح على جهاز آخر في نفس الوقت. يُسمح بجهاز واحد فقط في كل مرة.',
      });
    }

    // Upsert session for this user+book+ip
    const existing = await prisma.bookSession.findFirst({
      where: { userId: auth.userId, bookId, ipAddress: ip },
    });

    if (existing) {
      await prisma.bookSession.update({
        where: { id: existing.id },
        data: { lastPing: new Date() },
      });
    } else {
      // Clean up old sessions for this user+book first
      await prisma.bookSession.deleteMany({
        where: { userId: auth.userId, bookId, lastPing: { lt: cutoff } },
      });
      await prisma.bookSession.create({
        data: { userId: auth.userId, bookId, ipAddress: ip },
      });
    }

    return NextResponse.json({ ok: true, conflict: false });
  } catch (err) {
    console.error('[session POST]', err);
    return NextResponse.json({ ok: true }); // fail open — don't block reading
  }
}
