import webpush from 'web-push';
import { prisma } from './prisma';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:info@moslimleader.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  // Custom notification icon (e.g. sender's avatar for DMs)
  icon?: string;
  // Rich push (Feature 5): post image shown in the notification
  image?: string;
  // Notification type drives which action buttons appear in SW (Feature 4)
  type?: 'like' | 'comment' | 'message' | 'call' | 'generic';
  // Used by SW to build the 'reply' action deep-link (/tareeq/:postId#comments)
  postId?: string;
  // For call notifications: passed through to SW so it can wake open windows via postMessage
  callId?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    // Loudly, once per send: a missing key pair means NO background notifications at all,
    // and staying silent about it made the whole platform look like nobody had opted in.
    console.warn('[tareeq-push] VAPID keys are not configured — no push will be delivered');
    return;
  }

  const subs = await prisma.tareeqPushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (!subs.length) return;

  const json = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        json,
      ).catch(async (err: { statusCode?: number; body?: string }) => {
        // 410/404: the browser dropped the subscription — prune it.
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.tareeqPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return;
        }
        // Everything else was swallowed in silence, which hid a whole class of dead
        // subscription: a 403 means the VAPID key the browser subscribed with no longer
        // matches the pair the server signs with (someone rotated the keys, or .env had two
        // pairs and the later one won). Those rows are permanently undeliverable and
        // NOTHING pruned them, so the user simply never heard from us again.
        //
        // Deliberately NOT auto-deleted: a 403 can equally mean the SERVER is misconfigured
        // right now, and deleting on that would wipe every subscription on the platform.
        // Logged instead, so `pm2 logs` names the real cause.
        console.warn(
          `[tareeq-push] send failed status=${err.statusCode ?? '?'} user=${userId}` +
          (err.statusCode === 403
            ? ' — VAPID key mismatch: this subscription was created with a DIFFERENT public key.'
              + ' It can never be delivered to; the user must re-enable notifications.'
            : ''),
        );
      })
    )
  );
}
