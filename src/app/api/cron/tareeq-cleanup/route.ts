export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeHotScore } from '@/lib/tareeq-rank';

/**
 * Retention for the two Tareeq tables that grow without limit.
 *
 * `TareeqPostView` writes a row per viewer per post per day and nothing in the project
 * ever deleted one — no cleanup task, no retention policy. Read counts are already
 * denormalised onto `TareeqPost.viewCount`, so the rows exist only to answer "did this
 * person already see this today?", which is a question about today.
 *
 * Notifications are the same shape: a read notification older than a season is never
 * shown again, and the list endpoint takes 50.
 *
 * Authentication: shared CRON_SECRET, header `x-cron-key: <secret>` — the same
 * convention as /api/cron/khatmati-reminder and /api/cron/fb-follow-up. The variable and
 * the header have different names on purpose; getting them the wrong way round is what
 * left both of those answering 403 for a while.
 *
 * It also recomputes the «الأنفع» ranking score. That score has a recency term, so every
 * post's standing changes simply by time passing — a nightly pass is what keeps the feed
 * from freezing around whatever was popular the day each post was written.
 *
 * Install with:
 *   0 4 * * * curl -s -H "x-cron-key: $CRON_SECRET" https://moslimleader.com/api/cron/tareeq-cleanup
 */

const VIEW_RETENTION_DAYS = 90;
/** How far back to rescore. Older than this and nothing can realistically climb back. */
const RESCORE_DAYS = 60;
const READ_NOTIF_RETENTION_DAYS = 120;
/** Deleting in chunks keeps the row locks short — this table is on the hot view path. */
const BATCH = 5_000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-cron-key') === secret;
}

async function deleteInBatches(
  cutoff: Date,
  del: (cutoff: Date, take: number) => Promise<number>,
): Promise<number> {
  let total = 0;
  // Bounded: a runaway loop here would hold the connection for the whole night.
  for (let pass = 0; pass < 40; pass++) {
    const n = await del(cutoff, BATCH);
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const now = Date.now();
  const viewCutoff = new Date(now - VIEW_RETENTION_DAYS * 86_400_000);
  const notifCutoff = new Date(now - READ_NOTIF_RETENTION_DAYS * 86_400_000);

  try {
    const views = await deleteInBatches(viewCutoff, async (cutoff, take) => {
      // deleteMany has no `take`, so the ids are selected first. Same reason as the
      // batching itself: an unbounded DELETE on this table blocks the view path.
      const rows = await prisma.tareeqPostView.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take,
      });
      if (!rows.length) return 0;
      const r = await prisma.tareeqPostView.deleteMany({
        where: { id: { in: rows.map(x => x.id) } },
      });
      return r.count;
    });

    const notifs = await deleteInBatches(notifCutoff, async (cutoff, take) => {
      const rows = await prisma.tareeqNotification.findMany({
        // Unread is never deleted, however old: it is still something the user has not
        // seen, and silently dropping it would be worse than a long list.
        where: { read: true, createdAt: { lt: cutoff } },
        select: { id: true },
        take,
      });
      if (!rows.length) return 0;
      const r = await prisma.tareeqNotification.deleteMany({
        where: { id: { in: rows.map(x => x.id) } },
      });
      return r.count;
    });

    // Rescore recent posts. Bounded to 5,000: past that it is not a cron job any more,
    // and posts outside the window are not going to climb the feed regardless.
    let rescored = 0;
    const since = new Date(now - RESCORE_DAYS * 86_400_000);
    const recent = await prisma.tareeqPost.findMany({
      where: { isHidden: false, isDraft: false, createdAt: { gte: since } },
      select: {
        id: true, savedCount: true, likeCount: true, commentCount: true, shareCount: true,
        publishedAt: true, createdAt: true,
      },
      take: 5_000,
    });

    for (const p of recent) {
      const score = computeHotScore({
        savedCount: p.savedCount,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        shareCount: p.shareCount,
        // publishedAt is null for everything written before drafts existed.
        at: p.publishedAt ?? p.createdAt,
      });
      // Sequential, not Promise.all: five thousand concurrent updates would take every
      // connection in the pool, and the shop shares that pool.
      await prisma.tareeqPost.update({ where: { id: p.id }, data: { hotScore: score } }).catch(() => {});
      rescored++;
    }

    return NextResponse.json({
      ok: true,
      deleted: { views, readNotifications: notifs },
      rescored,
      retentionDays: { views: VIEW_RETENTION_DAYS, readNotifications: READ_NOTIF_RETENTION_DAYS },
    });
  } catch (e) {
    console.error('[tareeq-cleanup]', e);
    return NextResponse.json({ error: 'cleanup failed' }, { status: 500 });
  }
}
