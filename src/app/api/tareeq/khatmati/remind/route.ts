export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/tareeq-push';

/** POST — opt-in to daily Quran reminder push
 *  Body: { enable: boolean }
 *  The client should call /api/tareeq/push-subscribe first to register the subscription,
 *  then call this to store the reminder preference and send a confirmation push.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { enable?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const enable = !!body.enable;

  // Persist the preference — this used to only fire a one-time confirmation push and
  // never wrote anything to the database, so a daily reminder job would have had no
  // durable signal to read and toggling "off" did nothing at all server-side.
  await prisma.khatmatiProgress.upsert({
    where: { userId: user.userId },
    update: { dailyReminder: enable },
    create: { userId: user.userId, dailyReminder: enable },
  });

  if (enable) {
    // Send a welcome/confirmation push immediately so the user knows it's working
    await sendPushToUser(user.userId, {
      type: 'generic',
      title: 'نُوري — التذكير مُفعَّل 🕯️',
      body: 'سنذكّرك كل يوم بإشعال سراجك. اللهم اجعل القرآن ربيع قلوبنا.',
      url: '/tareeq/khatmati',
    }).catch(() => {/* ignore if no subscription yet */});
  }

  return NextResponse.json({ ok: true, dailyReminder: enable });
}
