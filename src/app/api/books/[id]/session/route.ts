export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';

/**
 * POST /api/books/[id]/session — start or ping a reading session.
 * Body: { fingerprint?: string }. Returns { conflict: true } when ANOTHER DEVICE is reading
 * this book on this account right now.
 *
 * ## What "another device" means here, and why it is no longer the IP
 *
 * Sessions were keyed by IP: a ping from a different IP within three minutes of the last
 * one was a conflict. A phone's IP is the least stable thing about it — it changes when
 * it moves from Wi-Fi to data, and carrier NAT rotates it on its own — so a reader on one
 * phone was told, every 90 seconds, that her account was open on another device. It was
 * her own session from three minutes ago. That is the "the book stopped working" report.
 *
 * A device is now identified by the browser fingerprint the reader page already computes
 * (the same one the device limit uses), with the user agent as the tie-breaker when a
 * fingerprint is missing. Two pings with the same fingerprint are one device wherever
 * they come from; two different fingerprints at the same time are the case this guard is
 * for — one account read on two phones at once — and only that raises the conflict.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ ok: true }); // not logged in, skip

    const { id: bookId } = await params;
    const body = await req.json().catch(() => ({}));
    const fingerprint = typeof body?.fingerprint === 'string' && body.fingerprint ? body.fingerprint.slice(0, 128) : null;
    const ua = req.headers.get('user-agent') || null;
    const ip = req.headers.get('cf-connecting-ip') ||
               req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || 'unknown';

    const ACTIVE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes = active session
    const now = new Date();
    const cutoff = new Date(now.getTime() - ACTIVE_WINDOW_MS);

    const active = await prisma.bookSession.findMany({
      where: { userId: auth.userId, bookId, lastPing: { gte: cutoff } },
      select: { id: true, fingerprint: true, userAgent: true, ipAddress: true },
    });

    // "This device" is the active session with the same fingerprint; failing that (an old
    // row written before fingerprints existed, or a client that sent none) the same user
    // agent; failing that the same IP, which is what the old code had.
    const mine = active.find(s => fingerprint && s.fingerprint === fingerprint)
      ?? active.find(s => !s.fingerprint && ua && s.userAgent === ua)
      ?? active.find(s => !s.fingerprint && !s.userAgent && s.ipAddress === ip);
    const others = active.filter(s => s.id !== mine?.id);

    if (others.length > 0) {
      return NextResponse.json({
        conflict: true,
        message: 'يبدو أن حسابك مفتوح على جهاز آخر في نفس الوقت. يُسمح بجهاز واحد فقط في كل مرة.',
      });
    }

    if (mine) {
      await prisma.bookSession.update({
        where: { id: mine.id },
        data: { lastPing: now, ipAddress: ip, fingerprint: fingerprint ?? mine.fingerprint, userAgent: ua ?? mine.userAgent },
      });
    } else {
      // Nothing active: clear the stale rows for this book and start fresh.
      await prisma.bookSession.deleteMany({ where: { userId: auth.userId, bookId, lastPing: { lt: cutoff } } });
      await prisma.bookSession.create({
        data: { userId: auth.userId, bookId, ipAddress: ip, fingerprint, userAgent: ua, lastPing: now },
      });
    }

    return NextResponse.json({ ok: true, conflict: false });
  } catch (err) {
    console.error('[session POST]', err);
    return NextResponse.json({ ok: true }); // fail open — don't block reading
  }
}
