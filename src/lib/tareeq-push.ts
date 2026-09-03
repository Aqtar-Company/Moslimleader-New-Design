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
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

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
      ).catch(async (err: { statusCode?: number }) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.tareeqPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      })
    )
  );
}
