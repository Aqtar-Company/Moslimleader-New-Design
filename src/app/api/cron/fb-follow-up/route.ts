export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendFacebookReply, getAssistantSettings } from '@/lib/ai-facebook-assistant';
import { getProfile } from '@/lib/conversation-extractor';

// Re-engage HOT leads who went silent. Runs every 30 min via:
//   - PM2 cron (preferred): `pm2 deploy ... && curl <url>` on schedule
//   - Or external cron-job.org / Hostinger cron hitting this URL
//
// Strategy:
//   • Find conversations with leadStatus=hot in the last 48h
//   • Where the LAST event is outgoing-auto (we're waiting on user)
//     OR incoming with no outgoing-auto reply within 4h
//   • Skip if a follow-up was already sent recently (Setting flag)
//   • Skip if the conversation is muted (admin took over)
//   • Send a templated nudge; mark follow-up:N flag (max 2 nudges)
//
// Authentication: a shared CRON_SECRET in env var. Header
// `x-cron-key: <secret>` must match. This stops public access.

const FOLLOW_UP_TEMPLATES: Array<{ stage: number; minHoursSince: number; maxHoursSince: number; render: (name: string | null) => string }> = [
  {
    stage: 1,
    minHoursSince: 4,
    maxHoursSince: 24,
    render: (name) => `أهلاً ${name ? name + ' ' : ''}🌹\nلاحظنا إنك كنتي مهتمة بمنتج معانا. لو في أي سؤال تاني أنا تحت أمرك.\nلو حابة تكملي الطلب، ابعتي رقمك والعنوان وأنا هخلّص الباقي 💛`,
  },
  {
    stage: 2,
    minHoursSince: 22,
    maxHoursSince: 48,
    render: (name) => `${name ? name + '،' : 'مرحباً مرة أخرى،'} الكتاب لسه متاح وفيه عرض لطيف ينتهي قريب — لو حابة أحجزلك نسخة أو أبعتلك تفاصيل الشحن، رد عليّ بـ "أيوه" وأنا هرتّبلك الطلب.`,
  },
];

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = req.headers.get('x-cron-key');
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const settings = await getAssistantSettings();
  if (!settings.enabled) {
    return NextResponse.json({ ok: true, skipped: 'assistant disabled' });
  }

  const now = Date.now();
  const since = new Date(now - 48 * 3600 * 1000);

  // Pull every conversation that's been HOT in the last 48 hours.
  // GROUP BY psid — for each, evaluate whether a follow-up is due.
  const hotEvents = await prisma.facebookEvent.findMany({
    where: {
      kind: 'message',
      leadStatus: 'hot',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { psid: true, createdAt: true },
  });

  const psids = Array.from(new Set(hotEvents.map(e => e.psid)));
  let sent = 0;
  let skipped = 0;
  const detail: Array<{ psid: string; action: 'sent' | 'skipped'; reason: string; stage?: number }> = [];

  for (const psid of psids) {
    // Mute check — admin manually took over.
    const muted = await prisma.setting.findUnique({ where: { key: `mute-psid-${psid}` } });
    if (muted?.value) {
      skipped++; detail.push({ psid, action: 'skipped', reason: 'muted' });
      continue;
    }

    // Most-recent event for this conversation. If the last thing
    // was a manual reply, the admin is engaged — don't auto-nudge.
    const lastEvent = await prisma.facebookEvent.findFirst({
      where: { psid, kind: 'message' },
      orderBy: { createdAt: 'desc' },
      select: { direction: true, createdAt: true, leadStatus: true },
    });
    if (!lastEvent) { skipped++; detail.push({ psid, action: 'skipped', reason: 'no events' }); continue; }
    if (lastEvent.direction === 'outgoing-manual') {
      skipped++; detail.push({ psid, action: 'skipped', reason: 'admin engaged' }); continue;
    }

    // Hours since last event from EITHER direction. We only follow
    // up when the conversation's been silent for ≥ 4h.
    const hoursSince = (now - lastEvent.createdAt.getTime()) / 3600000;

    // Pick the appropriate template stage based on prior follow-ups
    // sent. Cap at stage 2 so we don't spam.
    let chosen: typeof FOLLOW_UP_TEMPLATES[number] | null = null;
    let chosenStage = 0;
    for (const tpl of FOLLOW_UP_TEMPLATES) {
      const flag = await prisma.setting.findUnique({ where: { key: `follow-up:${psid}:${tpl.stage}` } });
      if (flag) continue; // already sent this stage
      if (hoursSince >= tpl.minHoursSince && hoursSince <= tpl.maxHoursSince) {
        chosen = tpl;
        chosenStage = tpl.stage;
        break;
      }
    }
    if (!chosen) {
      skipped++; detail.push({ psid, action: 'skipped', reason: `out of window (${hoursSince.toFixed(1)}h since last)` });
      continue;
    }

    // Personalise from the persisted profile.
    const profile = await getProfile(psid);
    const text = chosen.render(profile.name);

    const sendResult = await sendFacebookReply(psid, text);
    await prisma.facebookEvent.create({
      data: {
        psid,
        kind: 'message',
        direction: 'outgoing-auto',
        text,
        aiModel: `follow-up-v1-stage-${chosenStage}`,
        sendStatus: sendResult.ok ? 'sent' : 'failed',
        sendError: sendResult.ok ? null : sendResult.error ?? 'unknown',
      },
    }).catch(() => {/* swallow */});

    if (sendResult.ok) {
      await prisma.setting.upsert({
        where: { key: `follow-up:${psid}:${chosenStage}` },
        create: { key: `follow-up:${psid}:${chosenStage}`, value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      }).catch(() => {/* swallow */});
      sent++;
      detail.push({ psid, action: 'sent', reason: 'follow-up dispatched', stage: chosenStage });
    } else {
      skipped++;
      detail.push({ psid, action: 'skipped', reason: `send failed: ${sendResult.error}` });
    }
  }

  return NextResponse.json({
    ok: true,
    candidatesEvaluated: psids.length,
    sent,
    skipped,
    detail,
  });
}
