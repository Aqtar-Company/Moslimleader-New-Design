/**
 * إعلام المستخدمين — admin broadcasts.
 *
 * One message from the administration, delivered to many members on up to three channels.
 * This file owns everything that is not an HTTP handler: the vocabulary (kinds, audiences),
 * audience resolution, reach counting, and the background sender.
 *
 * ## Delivery model
 *
 * A send creates one `AdminBroadcastRecipient` row per user up front (idempotent via the
 * `@@unique([broadcastId, userId])`), marks the broadcast `sending`, and returns. The actual
 * work runs in `runBroadcast`, fire-and-forget on the PM2 fork — the same shape as
 * `src/lib/campaign-runner.ts`, and for the same reasons: an HTTP request must not stay
 * open for thirty minutes, and a process restart must not lose the send. `queued` rows are
 * the resume point: `runBroadcast` only ever processes those, so calling it again on a
 * half-finished broadcast picks up exactly where it stopped.
 *
 * ## Why the three channels are handled differently
 *
 * - **In-app** is a `TareeqNotification` row per recipient, written with `createMany` in
 *   chunks. Cheap. `postId` carries the broadcast id so the notifications screen can open
 *   `/tareeq/notices/<id>`.
 * - **Push** goes through `sendPushToUser` — one call per recipient, each of which may fan
 *   out to several devices. Bounded concurrency (`PUSH_CONCURRENCY`) so a broadcast to a
 *   thousand people does not open a thousand sockets at once on the box that runs the shop.
 * - **Email** is throttled to roughly Titan's limit (~30/min, `EMAIL_GAP_MS`), exactly like
 *   the marketing campaigns. A thousand emails take ~35 minutes; that is the cost of not
 *   getting the domain flagged, and it happens in the background.
 *
 * ## Preferences
 *
 * The recipient's `tareeqNotifPrefs.announcements` switch governs in-app and push for any
 * broadcast to an audience (all / tareeq / shop). A message addressed to a hand-picked list
 * is treated as personal correspondence and is always written in-app (push still respects
 * the switch — a push is an interruption; an inbox entry is not). Email respects
 * `marketingOptIn` unless the admin marked the message as a service message.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { sendPushToUser } from '@/lib/tareeq-push';
import { wantsNotif, type TareeqNotifType } from '@/lib/tareeq-notify';
import { getTransporter } from '@/lib/smtp';
import { renderTareeqEmail } from '@/lib/tareeq-email';
import { getBaseUrl } from '@/lib/marketing-mailer';
import { ensureMarketingToken } from '@/lib/campaign-runner';

// ─── Vocabulary — shared with the client, see admin-broadcast-shared.ts ─────────────────

export * from '@/lib/admin-broadcast-shared';
import {
  BROADCAST_KINDS, BROADCAST_SELECTED_MAX, BROADCAST_TITLE_MAX, BROADCAST_BODY_MAX,
  BROADCAST_LINK_LABEL_MAX, BROADCAST_ACTOR_NAME, isBroadcastKind, isBroadcastAudience,
  sanitizeBroadcastLink, type BroadcastKind, type BroadcastAudience,
} from '@/lib/admin-broadcast-shared';

/** Where a notification / push / email button for this broadcast should land. */
export function broadcastNoticeUrl(id: string): string {
  return `/tareeq/notices/${id}`;
}

// ─── Audience ───────────────────────────────────────────────────────────────────────────

/**
 * The Prisma `where` for an audience. Every audience requires an email on the row — a user
 * without one cannot exist (the column is required and unique), but the guard keeps the
 * type honest for the email channel.
 *
 * - `tareeq`: has opened Tareeq at least once (`tareeqLastSeen` is stamped by presence).
 * - `shop`:   never has. These are the customers who only know the store.
 */
export function audienceWhere(audience: BroadcastAudience, targetUserIds: string[] = []): Prisma.UserWhereInput {
  switch (audience) {
    // Broad audiences leave out suspended members — they are barred from the platform the
    // message is about. A hand-picked list may include one on purpose (e.g. to explain).
    case 'all':      return { tareeqSuspended: false };
    case 'tareeq':   return { tareeqSuspended: false, tareeqLastSeen: { not: null } };
    case 'shop':     return { tareeqSuspended: false, tareeqLastSeen: null };
    case 'selected': return { id: { in: targetUserIds.slice(0, BROADCAST_SELECTED_MAX) } };
    default:         return { id: { in: [] } }; // never "everyone" by accident
  }
}

export type Reach = {
  total: number;
  /** Members with at least one push subscription. */
  withPush: number;
  /** Members with a verified address — who a SERVICE email reaches. */
  emailVerified: number;
  /** Verified AND opted in to marketing — who a PROMOTIONAL email reaches. */
  emailOptIn: number;
};

/**
 * How many people a broadcast would reach on each channel — for the compose screen.
 *
 * The email numbers mirror `queueBroadcast` exactly, including the exemption for a
 * hand-picked list (no verified-address requirement there). A reach number that promises
 * more than the send delivers is worse than no number at all.
 */
export async function computeReach(audience: BroadcastAudience, targetUserIds: string[] = []): Promise<Reach> {
  const where = audienceWhere(audience, targetUserIds);
  const verified = audience === 'selected' ? {} : { emailVerified: true };
  const [total, withPush, emailVerified, emailOptIn] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, tareeqPushSubscriptions: { some: {} } } }),
    prisma.user.count({ where: { ...where, ...verified } }),
    prisma.user.count({ where: { ...where, ...verified, marketingOptIn: true } }),
  ]);
  return { total, withPush, emailVerified, emailOptIn };
}

// ─── Sending ────────────────────────────────────────────────────────────────────────────

const CHUNK = 100;
const PUSH_CONCURRENCY = 8;
/** ~30 emails a minute — Titan's comfortable ceiling, same as the marketing campaigns. */
const EMAIL_GAP_MS = 2000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Broadcasts THIS process is currently sending. PM2 runs one fork, so an in-memory set is a
 * valid guard against a double-click; clustering would need a DB lock instead.
 */
const running = new Set<string>();
export const isBroadcastRunning = (id: string) => running.has(id);

type BroadcastRow = NonNullable<Awaited<ReturnType<typeof prisma.adminBroadcast.findUnique>>>;

/** `{{firstName}}` → the recipient's first name, everywhere the text is shown. */
export function personalize(text: string, fullName: string | null | undefined): string {
  const first = (fullName || '').trim().split(/\s+/)[0] || '';
  return text.replace(/\{\{firstName\}\}/g, first);
}

/**
 * Create the recipient rows for a broadcast and mark it `sending`. Returns how many people
 * are on the list. Idempotent: re-running for a broadcast that already has rows only adds the
 * missing ones (someone who joined since) and requeues nothing that already finished — so it
 * is also the RESUME action for a canceled, failed, or orphaned (process restarted) send.
 *
 * Throws with an Arabic message the route can hand straight to the admin.
 */
export async function queueBroadcast(id: string): Promise<number> {
  const b = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!b) throw new Error('الرسالة غير موجودة');
  if (b.status === 'sending' && running.has(id)) throw new Error('الرسالة قيد الإرسال بالفعل');
  if (!b.channelInApp && !b.channelPush && !b.channelEmail) throw new Error('اختر قناة إرسال واحدة على الأقل');

  const audience = b.audience as BroadcastAudience;
  const ids = Array.isArray(b.targetUserIds) ? (b.targetUserIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (audience === 'selected' && ids.length === 0) throw new Error('لم يتم اختيار أي مستلم');

  // Rows whose ONLY failure was the email (an SMTP outage) go back in the queue. They are
  // requeued as `processing`, not `queued`, so the chunk treats them as leftovers: the
  // in-app row is checked against the notification table instead of written again, the push
  // is not repeated, and only the mail is retried. Without this a ten-minute Titan outage
  // left a permanently dead broadcast whose only recovery was composing a new one — which
  // would have re-notified everyone who already got it.
  const retried = await prisma.adminBroadcastRecipient.updateMany({
    where: { broadcastId: id, status: 'failed', emailStatus: 'failed' },
    data: { status: 'processing', emailStatus: 'queued', error: null },
  });
  if (retried.count > 0) {
    await prisma.adminBroadcast.update({
      where: { id },
      data: { emailFailedCount: 0, processedCount: { decrement: retried.count } },
    });
  }

  const users = await prisma.user.findMany({
    where: audienceWhere(audience, ids),
    select: { id: true, email: true, emailVerified: true, marketingOptIn: true },
  });
  if (users.length === 0) throw new Error('لا يوجد مستلمون مطابقون لهذا الجمهور');

  // Who may receive the email, and — when they may not — WHY, written on the row. The
  // report used to show a bare «—» for a skip, which is indistinguishable from a bug: the
  // first report of "the email never arrived" was a member whose address was simply never
  // verified, and nothing on the screen said so.
  //
  // A hand-picked list does NOT require a verified address. The bounce risk that rule
  // guards against is a mass send to thousands of stale signups; when the admin has typed
  // this person's name and chosen them, refusing to write to them is just a broken feature.
  const requireVerified = audience !== 'selected';
  const rows = users.map(u => {
    let emailStatus = 'skipped';
    let error: string | null = null;
    if (b.channelEmail) {
      if (requireVerified && !u.emailVerified) error = 'البريد غير مُفعَّل — لم يؤكد المستخدم بريده';
      else if (!b.serviceMessage && !u.marketingOptIn) error = 'المستخدم لم يوافق على الرسائل التسويقية — فعّل «رسالة خدمية» لتصله';
      else emailStatus = 'queued';
    }
    return { broadcastId: id, userId: u.id, email: u.email, emailStatus, error };
  });
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.adminBroadcastRecipient.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
  }

  const recipientCount = await prisma.adminBroadcastRecipient.count({ where: { broadcastId: id } });
  await prisma.adminBroadcast.update({
    where: { id },
    data: {
      status: 'sending',
      startedAt: b.startedAt ?? new Date(),
      finishedAt: null,
      error: null,
      recipientCount,
    },
  });
  return recipientCount;
}

/**
 * Deliver every pending recipient of a broadcast, then finalise its status. Never throws: a
 * failure is written to `AdminBroadcast.error` and the status becomes `failed`.
 *
 * ## Crash safety
 *
 * A chunk is CLAIMED (`status: processing`) before anything is delivered, and every email is
 * recorded on its row the moment it is sent. So after a restart mid-chunk (a deploy does
 * `pm2 stop` — realistic during a 35-minute email run) the resume sees `processing` rows and
 * knows: in-app is checked against the notification table (exact), push is NOT repeated (a
 * duplicate push is worse than a missing one), and only emails still `queued` on the row go
 * out. Nobody gets the same email twice.
 *
 * Safe to call again on the same id — a second concurrent call returns at once. If the
 * status was flipped back to `sending` (resume) while this run was winding down, the run
 * restarts itself so the broadcast never sits at `sending` with no runner.
 */
export async function runBroadcast(id: string): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  let finalized = false;
  try {
    const b = await prisma.adminBroadcast.findUnique({ where: { id } });
    if (!b || b.status !== 'sending') return;
    const kindDef = BROADCAST_KINDS[b.kind as BroadcastKind];
    const notifType = kindDef?.notifType ?? 'admin_note';
    const personal = b.audience === 'selected';
    const url = broadcastNoticeUrl(b.id);

    for (;;) {
      // Re-read the status before each chunk so "cancel" takes effect within one chunk.
      const fresh = await prisma.adminBroadcast.findUnique({ where: { id }, select: { status: true } });
      if (fresh?.status !== 'sending') return;

      // No cursor: every processed row leaves this filter, so the query is its own cursor.
      // (A cursor on a row that no longer matches the filter made `skip: 1` drop a real
      // recipient on every chunk after the first.)
      const batch = await prisma.adminBroadcastRecipient.findMany({
        where: { broadcastId: id, status: { in: ['queued', 'processing'] } },
        // `processing` sorts before `queued` ascending, so crash leftovers drain FIRST and
        // the window in which a row sits claimed-but-unfinished stays as short as possible.
        orderBy: [{ status: 'asc' }, { id: 'asc' }],
        take: CHUNK,
        include: {
          user: { select: { id: true, name: true, email: true, tareeqNotifPrefs: true, tareeqPushSubscriptions: { select: { id: true }, take: 1 } } },
        },
      });
      if (batch.length === 0) break;
      const ids = batch.map(r => r.id);

      // Claim the chunk before delivering anything.
      await prisma.adminBroadcastRecipient.updateMany({ where: { id: { in: ids }, status: 'queued' }, data: { status: 'processing' } });

      const leftovers = batch.filter(r => r.status === 'processing'); // from a crashed run
      const wants = new Map<string, boolean>();
      for (const r of batch) wants.set(r.userId, wantsNotif(r.user.tareeqNotifPrefs, notifType as TareeqNotifType));

      // 1. In-app — one createMany for the chunk. Leftovers are checked against the table so
      //    a crash between createMany and the claim cannot produce a second bell entry.
      let inAppIds = new Set<string>();
      if (b.channelInApp) {
        const eligible = batch.filter(r => personal || wants.get(r.userId));
        const already = leftovers.length
          ? new Set((await prisma.tareeqNotification.findMany({
              where: { postId: b.id, userId: { in: leftovers.map(r => r.userId) }, type: { startsWith: 'admin_' } },
              select: { userId: true },
            })).map(n => n.userId))
          : new Set<string>();
        const toWrite = eligible.filter(r => !already.has(r.userId));
        if (toWrite.length) {
          await prisma.tareeqNotification.createMany({
            data: toWrite.map(r => {
              const body = personalize(b.body, r.user.name);
              return {
                userId: r.userId,
                type: notifType,
                actorName: BROADCAST_ACTOR_NAME,
                postId: b.id,
                postTitle: personalize(b.title, r.user.name).slice(0, 190),
                body: body.length > 280 ? `${body.slice(0, 277)}…` : body,
              };
            }),
          });
        }
        inAppIds = new Set([...eligible.map(r => r.userId)]);
      }

      // 2. Push — only people with a device, only fresh rows, bounded concurrency. Counted
      //    only when the person actually has a subscription, so the report is not fiction.
      const pushed = new Set<string>();
      if (b.channelPush) {
        const targets = batch.filter(r => r.status === 'queued' && wants.get(r.userId) && r.user.tareeqPushSubscriptions.length > 0);
        for (let i = 0; i < targets.length; i += PUSH_CONCURRENCY) {
          await Promise.all(targets.slice(i, i + PUSH_CONCURRENCY).map(async r => {
            try {
              const body = personalize(b.body, r.user.name);
              // Counted only when a device actually ACCEPTED it — sendPushToUser returns the
              // number of endpoints that took it, which is 0 when VAPID is misconfigured.
              const delivered = await sendPushToUser(r.userId, {
                title: `${kindDef?.icon ?? '📣'} ${personalize(b.title, r.user.name)}`,
                body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
                url,
                tag: `tareeq-broadcast-${b.id}`,
                type: 'generic',
              });
              if (delivered > 0) pushed.add(r.userId);
            } catch { /* a dead device is not a failed recipient */ }
          }));
        }
      }

      // 3. Email — sequential, throttled, and RECORDED PER ROW as it goes.
      //
      // The cancel check is INSIDE this loop, not only before the chunk: at one mail every
      // two seconds a full chunk takes three and a half minutes, and an admin pressing
      // «إيقاف» to stop a mistake should not watch it keep mailing for that long. Breaking
      // out mid-loop is safe — every mail already sent is recorded on its own row, and the
      // rows not reached stay `processing` for the resume.
      const emailResult = new Map<string, boolean>();
      let canceledMidChunk = false;
      let sentThisChunk = 0;
      for (const r of batch) {
        if (r.emailStatus !== 'queued' || !r.email) continue;
        if (sentThisChunk > 0 && sentThisChunk % 10 === 0) {
          const still = await prisma.adminBroadcast.findUnique({ where: { id }, select: { status: true } });
          if (still?.status !== 'sending') { canceledMidChunk = true; break; }
        }
        sentThisChunk++;
        try {
          await sendBroadcastEmail({ to: r.email, userId: r.userId, name: r.user.name, broadcast: b });
          emailResult.set(r.userId, true);
          await prisma.adminBroadcastRecipient.update({ where: { id: r.id }, data: { emailStatus: 'sent', error: null } });
        } catch (e) {
          emailResult.set(r.userId, false);
          await prisma.adminBroadcastRecipient.update({
            where: { id: r.id },
            data: { emailStatus: 'failed', error: String((e as Error)?.message ?? e).slice(0, 480) },
          });
        }
        await sleep(EMAIL_GAP_MS);
      }

      // 4. Close the chunk. Row statuses and the broadcast counters commit in ONE
      //    transaction, so a crash cannot leave the progress bar disagreeing with the rows.
      // A chunk cut short by «إيقاف» closes only the rows it actually handled; the rest
      // keep their `processing` claim so the resume picks them up.
      const closing = canceledMidChunk
        ? batch.filter(r => emailResult.has(r.userId) || r.emailStatus !== 'queued')
        : batch;
      let inApp = 0, push = 0, emailOk = 0, emailKo = 0;
      const rowUpdates = closing.map(r => {
        const sentInApp = r.status === 'queued' ? inAppIds.has(r.userId) : r.inAppSent || inAppIds.has(r.userId);
        const sentPush = r.status === 'queued' ? pushed.has(r.userId) : r.pushSent;
        const em = emailResult.get(r.userId);
        if (sentInApp && !r.inAppSent) inApp++;
        if (sentPush && !r.pushSent) push++;
        if (em === true) emailOk++;
        if (em === false) emailKo++;
        const emailFailed = em === false || (em === undefined && r.emailStatus === 'failed');
        return prisma.adminBroadcastRecipient.update({
          where: { id: r.id },
          data: { status: emailFailed ? 'failed' : 'done', inAppSent: sentInApp, pushSent: sentPush },
        });
      });
      await prisma.$transaction([
        ...rowUpdates,
        prisma.adminBroadcast.update({
          where: { id },
          data: {
            processedCount: { increment: closing.length },
            inAppCount: { increment: inApp },
            pushCount: { increment: push },
            emailSentCount: { increment: emailOk },
            emailFailedCount: { increment: emailKo },
          },
        }),
      ]);
    }

    // Finalise — from the recipient table, not from the counters, so it is exact.
    const done = await prisma.adminBroadcast.findUnique({ where: { id }, select: { status: true, channelEmail: true, channelPush: true, channelInApp: true } });
    if (done?.status !== 'sending') return;
    const [pending, total, emailSent, emailFailed, pushSent, inAppSent] = await Promise.all([
      prisma.adminBroadcastRecipient.count({ where: { broadcastId: id, status: { in: ['queued', 'processing'] } } }),
      prisma.adminBroadcastRecipient.count({ where: { broadcastId: id } }),
      prisma.adminBroadcastRecipient.count({ where: { broadcastId: id, emailStatus: 'sent' } }),
      prisma.adminBroadcastRecipient.count({ where: { broadcastId: id, emailStatus: 'failed' } }),
      prisma.adminBroadcastRecipient.count({ where: { broadcastId: id, pushSent: true } }),
      prisma.adminBroadcastRecipient.count({ where: { broadcastId: id, inAppSent: true } }),
    ]);
    if (pending > 0) return; // never write `sent` with people still waiting
    // `failed` only when a channel was the point and not one delivery got through; partial
    // failures are still `sent`, with the failures listed per recipient.
    // Email failing does NOT fail a broadcast that also reached people in-app or by push —
    // those deliveries happened. Same rule as the push branch below.
    const allEmailFailed = done.channelEmail && !done.channelInApp && !done.channelPush && emailSent === 0 && emailFailed > 0;
    const noPushAtAll = done.channelPush && !done.channelInApp && !done.channelEmail && pushSent === 0 && total > 0;
    await prisma.adminBroadcast.update({
      where: { id },
      data: {
        status: allEmailFailed || noPushAtAll ? 'failed' : 'sent',
        finishedAt: new Date(),
        processedCount: total,
        emailSentCount: emailSent,
        emailFailedCount: emailFailed,
        pushCount: pushSent,
        inAppCount: inAppSent,
        error: allEmailFailed ? 'لم ينجح إرسال أي بريد — راجع إعدادات SMTP'
          : noPushAtAll ? 'لم يُسلَّم أي إشعار push — تحقق من مفاتيح VAPID أو أن أحداً فعّل الإشعارات'
          : null,
      },
    });
    finalized = true;
  } catch (e) {
    console.error('[admin-broadcast] run failed', id, e);
    finalized = true;
    await prisma.adminBroadcast.update({
      where: { id },
      data: { status: 'failed', finishedAt: new Date(), error: String((e as Error)?.message ?? e).slice(0, 2000) },
    }).catch(() => {});
  } finally {
    running.delete(id);
    if (!finalized) {
      // We left because the status was not `sending` at some point. If the admin resumed
      // in the meantime (cancel → resume within one chunk), the status is `sending` again
      // and nothing else is running it: pick it up.
      const again = await prisma.adminBroadcast.findUnique({ where: { id }, select: { status: true } }).catch(() => null);
      if (again?.status === 'sending') void runBroadcast(id);
    }
  }
}

/**
 * Broadcasts left at `sending` by a process that is no longer running them — a restart
 * mid-send. Called from the admin list route, so opening the tab after a deploy resumes
 * anything orphaned without a separate boot hook.
 */
let lastOrphanSweep = 0;
export async function resumeOrphanedBroadcasts(): Promise<number> {
  // The admin screen polls every 3s while a send runs; the sweep itself is only useful
  // after a restart, so once every 30s is plenty and keeps the poll free.
  if (Date.now() - lastOrphanSweep < 30_000) return 0;
  lastOrphanSweep = Date.now();
  const rows = await prisma.adminBroadcast.findMany({ where: { status: 'sending' }, select: { id: true }, take: 20 });
  let kicked = 0;
  for (const r of rows) {
    if (running.has(r.id)) continue;
    kicked++;
    void runBroadcast(r.id);
  }
  return kicked;
}

// ─── Email ──────────────────────────────────────────────────────────────────────────────

async function sendBroadcastEmail(opts: { to: string; userId: string; name: string | null; broadcast: BroadcastRow }) {
  const { broadcast: b } = opts;
  const baseUrl = getBaseUrl();
  const kind = BROADCAST_KINDS[b.kind as BroadcastKind];
  const ctaUrl = b.linkUrl
    ? (b.linkUrl.startsWith('/') ? `${baseUrl}${b.linkUrl}` : b.linkUrl)
    : `${baseUrl}${broadcastNoticeUrl(b.id)}`;
  const fromEmail = process.env.SMTP_USER || 'orders@moslimleader.com';

  // Promotional messages carry the one-click unsubscribe pair Gmail/Yahoo require of bulk
  // senders, and the matching link in the footer. Service messages (an outage notice, a
  // policy change) do not offer opting out — that is what "service" means — and Gmail does
  // not require the header on them.
  const headers: Record<string, string> = { 'X-Campaign': 'moslimleader-broadcast' };
  let unsubscribeUrl: string | null = null;
  if (!b.serviceMessage) {
    const token = await ensureMarketingToken(opts.userId);
    unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${token}`;
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>, <mailto:${fromEmail}?subject=unsubscribe>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const html = renderTareeqEmail({
    baseUrl,
    kindLabel: kind?.ar ?? 'رسالة',
    kindIcon: kind?.icon ?? '📣',
    title: personalize(b.title, opts.name),
    bodyText: personalize(b.body, opts.name),
    ctaLabel: b.linkLabel || (b.linkUrl ? 'افتح الرابط' : 'اقرأ في طريق'),
    ctaUrl,
    unsubscribeUrl,
  });

  await getTransporter().sendMail({
    // The sender NAME is طريق, not the shop — the member subscribed to a platform with its
    // own identity, and mail dressed as the store reads as mail from a stranger. The
    // ADDRESS stays the shop's authenticated mailbox: SPF/DKIM are published for that
    // domain, and inventing a from-address the domain does not authenticate is the fastest
    // way into a spam folder.
    from: `"طريق — مسلم ليدر" <${fromEmail}>`,
    replyTo: process.env.TAREEQ_REPLY_TO || 'info@moslimleader.com',
    to: opts.to,
    subject: `${kind?.icon ?? '📣'} ${personalize(b.title, opts.name)}`,
    html,
    headers,
  });
}

/**
 * The "send me a test" button: delivers the draft to ONE user (the admin) on the chosen
 * channels, writes no recipient rows and touches no counters. The in-app row is real, so
 * the admin sees exactly what members will see, and can delete it like any notification.
 */
export async function sendBroadcastTest(id: string, toUserId: string): Promise<{ inApp: boolean; push: boolean; email: boolean }> {
  const b = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!b) throw new Error('الرسالة غير موجودة');
  const user = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, name: true, email: true } });
  if (!user) throw new Error('المستخدم غير موجود');
  const notifType = BROADCAST_KINDS[b.kind as BroadcastKind]?.notifType ?? 'admin_note';
  const result = { inApp: false, push: false, email: false };

  if (b.channelInApp) {
    await prisma.tareeqNotification.create({
      data: { userId: user.id, type: notifType, actorName: BROADCAST_ACTOR_NAME, postId: b.id, postTitle: `[تجريبي] ${personalize(b.title, user.name)}`.slice(0, 190), body: personalize(b.body, user.name).slice(0, 280) },
    });
    result.inApp = true;
  }
  if (b.channelPush) {
    await sendPushToUser(user.id, {
      title: `[تجريبي] ${personalize(b.title, user.name)}`,
      body: personalize(b.body, user.name).slice(0, 180),
      url: broadcastNoticeUrl(b.id),
      tag: `tareeq-broadcast-test-${b.id}`,
      type: 'generic',
    });
    result.push = true;
  }
  if (b.channelEmail) {
    await sendBroadcastEmail({ to: user.email, userId: user.id, name: user.name, broadcast: b });
    result.email = true;
  }
  return result;
}

// ─── Shared by the admin routes ─────────────────────────────────────────────────────────

export const BROADCAST_LIST_SELECT = {
  id: true, kind: true, title: true, body: true, linkUrl: true, linkLabel: true,
  audience: true, targetUserIds: true,
  channelInApp: true, channelPush: true, channelEmail: true, serviceMessage: true,
  status: true, recipientCount: true, processedCount: true, inAppCount: true, pushCount: true,
  emailSentCount: true, emailFailedCount: true, error: true,
  createdByName: true, createdAt: true, startedAt: true, finishedAt: true,
} as const;

/**
 * Validates and normalises a compose payload. Returns an Arabic error or the clean data.
 * Lives here rather than in the route file: Next.js 14 rejects non-handler exports from a
 * `route.ts`, and both the create and the update handlers need it.
 */
export function parseBroadcastInput(body: Record<string, unknown>) {
  const kind = body.kind;
  if (!isBroadcastKind(kind)) return { error: 'نوع الرسالة غير صالح' } as const;
  const audience = body.audience;
  if (!isBroadcastAudience(audience)) return { error: 'الجمهور غير صالح' } as const;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'العنوان مطلوب' } as const;
  if (title.length > BROADCAST_TITLE_MAX) return { error: `العنوان أطول من ${BROADCAST_TITLE_MAX} حرفاً` } as const;

  const text = typeof body.body === 'string' ? body.body.replace(/\r\n/g, '\n').trim() : '';
  if (!text) return { error: 'نص الرسالة مطلوب' } as const;
  if (text.length > BROADCAST_BODY_MAX) return { error: `النص أطول من ${BROADCAST_BODY_MAX} حرف` } as const;

  const linkUrl = sanitizeBroadcastLink(body.linkUrl);
  if (typeof body.linkUrl === 'string' && body.linkUrl.trim() && !linkUrl) return { error: 'الرابط غير صالح — يجب أن يبدأ بـ https:// أو /' } as const;
  const linkLabel = typeof body.linkLabel === 'string' ? body.linkLabel.trim().slice(0, BROADCAST_LINK_LABEL_MAX) : '';

  let targetUserIds: string[] = [];
  if (audience === 'selected') {
    const raw = Array.isArray(body.targetUserIds) ? body.targetUserIds : [];
    targetUserIds = Array.from(new Set(raw.filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{5,64}$/.test(x))));
    if (targetUserIds.length === 0) return { error: 'اختر مستلماً واحداً على الأقل' } as const;
    if (targetUserIds.length > BROADCAST_SELECTED_MAX) return { error: `الحد الأقصى ${BROADCAST_SELECTED_MAX} مستلم في الرسالة الواحدة — استخدم جمهوراً عاماً` } as const;
  }

  const channelInApp = body.channelInApp !== false;
  const channelPush = body.channelPush !== false;
  const channelEmail = body.channelEmail === true;
  if (!channelInApp && !channelPush && !channelEmail) return { error: 'اختر قناة إرسال واحدة على الأقل' } as const;
  // Promotional by default only for announcements; everything else is a service message.
  const serviceMessage = typeof body.serviceMessage === 'boolean' ? body.serviceMessage : kind !== 'announcement';

  return {
    data: {
      kind, audience, title, body: text,
      linkUrl, linkLabel: linkUrl ? (linkLabel || null) : null,
      targetUserIds: audience === 'selected' ? targetUserIds : null,
      channelInApp, channelPush, channelEmail, serviceMessage,
    },
  } as const;
}

/** What a MEMBER sees of a broadcast — no audience, counters or channel flags. */
export const NOTICE_SELECT = {
  id: true, kind: true, title: true, body: true, linkUrl: true, linkLabel: true,
  startedAt: true, createdAt: true,
} as const;
