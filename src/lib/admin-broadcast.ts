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
import { sendPushToUser } from '@/lib/tareeq-push';
import { wantsNotif, type TareeqNotifType } from '@/lib/tareeq-notify';
import { getTransporter } from '@/lib/smtp';
import { renderPlainTextEmail } from '@/lib/email-template';
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
export function audienceWhere(audience: BroadcastAudience, targetUserIds: string[] = []) {
  switch (audience) {
    case 'all':      return {};
    case 'tareeq':   return { tareeqLastSeen: { not: null } };
    case 'shop':     return { tareeqLastSeen: null };
    case 'selected': return { id: { in: targetUserIds.slice(0, BROADCAST_SELECTED_MAX) } };
  }
}

export type Reach = {
  total: number;
  /** Members with at least one push subscription. */
  withPush: number;
  /** Members reachable by email for a promotional (non-service) message. */
  emailOptIn: number;
};

/** How many people a broadcast would reach on each channel — for the compose screen. */
export async function computeReach(audience: BroadcastAudience, targetUserIds: string[] = []): Promise<Reach> {
  const where = audienceWhere(audience, targetUserIds);
  const [total, withPush, emailOptIn] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, tareeqPushSubscriptions: { some: {} } } }),
    prisma.user.count({ where: { ...where, marketingOptIn: true } }),
  ]);
  return { total, withPush, emailOptIn };
}

// ─── Sending ────────────────────────────────────────────────────────────────────────────

const CHUNK = 100;
const PUSH_CONCURRENCY = 8;
/** ~30 emails a minute — Titan's comfortable ceiling, same as the marketing campaigns. */
const EMAIL_GAP_MS = 2000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Broadcasts this process is currently sending. Guards against a double-click on "send". */
const running = new Set<string>();

type BroadcastRow = NonNullable<Awaited<ReturnType<typeof prisma.adminBroadcast.findUnique>>>;

/**
 * Create the recipient rows for a broadcast and mark it `sending`. Returns how many people
 * were queued. Idempotent: re-running for a broadcast that already has rows only adds the
 * missing ones (someone who joined since) and requeues nothing that already finished.
 *
 * Throws with an Arabic message the route can hand straight to the admin.
 */
export async function queueBroadcast(id: string): Promise<number> {
  const b = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!b) throw new Error('الرسالة غير موجودة');
  if (b.status === 'sending') throw new Error('الرسالة قيد الإرسال بالفعل');
  if (!b.channelInApp && !b.channelPush && !b.channelEmail) throw new Error('اختر قناة إرسال واحدة على الأقل');

  const audience = b.audience as BroadcastAudience;
  const ids = Array.isArray(b.targetUserIds) ? (b.targetUserIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  if (audience === 'selected' && ids.length === 0) throw new Error('لم يتم اختيار أي مستلم');

  const users = await prisma.user.findMany({
    where: audienceWhere(audience, ids),
    select: { id: true, email: true, marketingOptIn: true },
  });
  if (users.length === 0) throw new Error('لا يوجد مستلمون مطابقون لهذا الجمهور');

  // Email is queued only for those who may receive it; the rest are `skipped`, which the
  // report shows honestly instead of counting them as failures.
  const rows = users.map(u => ({
    broadcastId: id,
    userId: u.id,
    email: u.email,
    emailStatus: b.channelEmail && (b.serviceMessage || u.marketingOptIn) ? 'queued' : 'skipped',
  }));
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
 * Deliver every `queued` recipient of a broadcast, then finalise its status. Never throws:
 * a failure is written to `AdminBroadcast.error` and the status becomes `failed`.
 *
 * Safe to call again on the same id — a second concurrent call returns at once, and a later
 * call after a crash resumes the remaining rows.
 */
export async function runBroadcast(id: string): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  try {
    const b = await prisma.adminBroadcast.findUnique({ where: { id } });
    if (!b || b.status !== 'sending') return;
    const notifType = BROADCAST_KINDS[b.kind as BroadcastKind]?.notifType ?? 'admin_note';
    const personal = b.audience === 'selected';
    const url = broadcastNoticeUrl(b.id);

    // Rows are fetched a chunk at a time by cursor, so a huge audience never sits in memory,
    // and each chunk re-reads the status so "cancel" takes effect within one chunk.
    let cursor: string | undefined;
    for (;;) {
      const fresh = await prisma.adminBroadcast.findUnique({ where: { id }, select: { status: true } });
      if (fresh?.status !== 'sending') return; // canceled from the admin screen

      const batch = await prisma.adminBroadcastRecipient.findMany({
        where: { broadcastId: id, status: 'queued' },
        orderBy: { id: 'asc' },
        take: CHUNK,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { user: { select: { id: true, name: true, email: true, tareeqNotifPrefs: true } } },
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;

      const wants = new Map<string, boolean>();
      for (const r of batch) wants.set(r.userId, wantsNotif(r.user.tareeqNotifPrefs, notifType as TareeqNotifType));

      // 1. In-app — one createMany for the whole chunk.
      const inAppIds = b.channelInApp
        ? batch.filter(r => personal || wants.get(r.userId)).map(r => r.userId)
        : [];
      if (inAppIds.length) {
        await prisma.tareeqNotification.createMany({
          data: inAppIds.map(userId => ({
            userId,
            type: notifType,
            actorName: b.createdByName ?? BROADCAST_ACTOR_NAME,
            postId: b.id,
            postTitle: b.title,
            body: b.body.length > 280 ? `${b.body.slice(0, 277)}…` : b.body,
          })),
        });
      }

      // 2. Push — bounded concurrency.
      const pushTargets = b.channelPush ? batch.filter(r => wants.get(r.userId)) : [];
      const pushed = new Set<string>();
      for (let i = 0; i < pushTargets.length; i += PUSH_CONCURRENCY) {
        await Promise.all(pushTargets.slice(i, i + PUSH_CONCURRENCY).map(async r => {
          try {
            await sendPushToUser(r.userId, {
              title: `${BROADCAST_KINDS[b.kind as BroadcastKind]?.icon ?? '📣'} ${b.title}`,
              body: b.body.length > 180 ? `${b.body.slice(0, 177)}…` : b.body,
              url,
              tag: `tareeq-broadcast-${b.id}`,
              type: 'generic',
            });
            pushed.add(r.userId);
          } catch { /* a dead device is not a failed recipient */ }
        }));
      }

      // 3. Email — sequential, throttled.
      const emailResult = new Map<string, { ok: boolean; error?: string }>();
      for (const r of batch) {
        if (r.emailStatus !== 'queued' || !r.email) continue;
        try {
          await sendBroadcastEmail({
            to: r.email,
            userId: r.userId,
            firstName: (r.user.name || '').split(/\s+/)[0] || '',
            broadcast: b,
          });
          emailResult.set(r.userId, { ok: true });
        } catch (e) {
          emailResult.set(r.userId, { ok: false, error: String((e as Error)?.message ?? e).slice(0, 480) });
        }
        await sleep(EMAIL_GAP_MS);
      }

      // 4. Book-keeping for the chunk. Per-row updates so the report is exact; the counters
      //    on the broadcast are incremented once per chunk.
      let inApp = 0, push = 0, emailOk = 0, emailKo = 0;
      await prisma.$transaction(batch.map(r => {
        const sentInApp = inAppIds.includes(r.userId);
        const sentPush = pushed.has(r.userId);
        const em = emailResult.get(r.userId);
        if (sentInApp) inApp++;
        if (sentPush) push++;
        if (em?.ok) emailOk++;
        if (em && !em.ok) emailKo++;
        return prisma.adminBroadcastRecipient.update({
          where: { id: r.id },
          data: {
            status: em && !em.ok ? 'failed' : 'done',
            inAppSent: sentInApp,
            pushSent: sentPush,
            emailStatus: em ? (em.ok ? 'sent' : 'failed') : r.emailStatus,
            error: em && !em.ok ? em.error : null,
          },
        });
      }));
      await prisma.adminBroadcast.update({
        where: { id },
        data: {
          processedCount: { increment: batch.length },
          inAppCount: { increment: inApp },
          pushCount: { increment: push },
          emailSentCount: { increment: emailOk },
          emailFailedCount: { increment: emailKo },
        },
      });
    }

    const done = await prisma.adminBroadcast.findUnique({ where: { id }, select: { status: true, recipientCount: true, emailFailedCount: true, channelEmail: true, emailSentCount: true } });
    if (done?.status !== 'sending') return;
    // `failed` only when email was the point and not one got through; partial failures
    // are still `sent`, with the failures listed per recipient.
    const allEmailFailed = done.channelEmail && done.emailSentCount === 0 && done.emailFailedCount > 0;
    await prisma.adminBroadcast.update({
      where: { id },
      data: { status: allEmailFailed ? 'failed' : 'sent', finishedAt: new Date(), error: allEmailFailed ? 'لم ينجح إرسال أي بريد — راجع إعدادات SMTP' : null },
    });
  } catch (e) {
    console.error('[admin-broadcast] run failed', id, e);
    await prisma.adminBroadcast.update({
      where: { id },
      data: { status: 'failed', finishedAt: new Date(), error: String((e as Error)?.message ?? e).slice(0, 2000) },
    }).catch(() => {});
  } finally {
    running.delete(id);
  }
}

// ─── Email ──────────────────────────────────────────────────────────────────────────────

async function sendBroadcastEmail(opts: { to: string; userId: string; firstName: string; broadcast: BroadcastRow }) {
  const { broadcast: b } = opts;
  const baseUrl = getBaseUrl();
  const kind = BROADCAST_KINDS[b.kind as BroadcastKind];
  const ctaUrl = b.linkUrl
    ? (b.linkUrl.startsWith('/') ? `${baseUrl}${b.linkUrl}` : b.linkUrl)
    : `${baseUrl}${broadcastNoticeUrl(b.id)}`;
  const html = renderPlainTextEmail({
    bodyText: b.body,
    firstName: opts.firstName,
    ctaLabel: b.linkLabel || (b.linkUrl ? 'افتح الرابط' : 'اقرأ في طريق'),
    ctaUrl,
  });
  const fromName = process.env.SMTP_FROM_NAME || 'Moslim Leader';
  const fromEmail = process.env.SMTP_USER || 'orders@moslimleader.com';

  // Promotional messages carry the one-click unsubscribe pair Gmail/Yahoo require of bulk
  // senders. Service messages (an outage notice, a policy change) do not offer opting out —
  // that is what "service" means — and Gmail does not require the header on them.
  const headers: Record<string, string> = { 'X-Campaign': 'moslimleader-broadcast' };
  if (!b.serviceMessage) {
    const token = await ensureMarketingToken(opts.userId);
    const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?token=${token}`;
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>, <mailto:${fromEmail}?subject=unsubscribe>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: opts.to,
    subject: `${kind?.icon ?? '📣'} ${b.title}`,
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
      data: { userId: user.id, type: notifType, actorName: b.createdByName ?? BROADCAST_ACTOR_NAME, postId: b.id, postTitle: `[تجريبي] ${b.title}`, body: b.body.slice(0, 280) },
    });
    result.inApp = true;
  }
  if (b.channelPush) {
    await sendPushToUser(user.id, {
      title: `[تجريبي] ${b.title}`,
      body: b.body.slice(0, 180),
      url: broadcastNoticeUrl(b.id),
      tag: `tareeq-broadcast-test-${b.id}`,
      type: 'generic',
    });
    result.push = true;
  }
  if (b.channelEmail) {
    await sendBroadcastEmail({ to: user.email, userId: user.id, firstName: (user.name || '').split(/\s+/)[0] || '', broadcast: b });
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
  createdByName: true, startedAt: true, createdAt: true,
} as const;
