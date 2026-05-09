export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAssistantSettings,
  callAi,
  shouldAutoReply,
  extractLeadTag,
} from '@/lib/ai-facebook-assistant';
import { buildAssistantContext } from '@/lib/assistant-knowledge';
import {
  extractFromMessage,
  updateProfile,
  renderProfileForPrompt,
} from '@/lib/conversation-extractor';
import { transcribeAudio, SttError } from '@/lib/stt';

const AUDIO_MAX_BYTES = 25 * 1024 * 1024; // 25 MB cap (defensive — client caps at 60 s).

// Public endpoint that powers the on-site Ameen chat. Re-uses the
// SAME machinery as the Facebook assistant (settings, prompt,
// catalogue context, lead/intent tagging, customer-data extraction)
// so the bot's behaviour is identical across channels — just a
// different transport.
//
// Conversations land in `FacebookEvent` with kind='website-chat'
// so the admin inbox at /admin/ai-facebook-assistant shows them
// alongside Messenger DMs and Page comments. The "psid" field
// holds a per-browser session id (stored in localStorage on the
// client).
//
// Auth: public, rate-limited (15 messages / 5 min / IP) +
// honeypot. No CAPTCHA — a public-facing chat needs to feel
// instant, and the rate limit + honeypot catches casual abuse.

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 15;
const ipHits = new Map<string, number[]>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

interface ChatBody {
  sessionId?: string;
  message?: string;
  /** Optional caller-supplied identity. The model also tries to
   *  extract these from message text, but a logged-in user can
   *  pass them up front so the bot personalises right away. */
  name?: string;
  email?: string;
  phone?: string;
  /** Hidden honeypot field — bots fill it. */
  website?: string;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: 'تم تجاوز عدد الرسائل المسموح. حاول مرة أخرى بعد قليل.' },
      { status: 429 },
    );
  }

  // Body shape can be either JSON (text message) or multipart/form-data
  // (voice message — `audio` field with the recorded blob, plus the
  // same metadata fields). Voice messages get transcribed via Gemini
  // before flowing through the rest of the pipeline unchanged.
  let body: ChatBody;
  let transcribed = false;
  const ct = req.headers.get('content-type') || '';
  if (ct.startsWith('multipart/form-data')) {
    try {
      const form = await req.formData();
      const audio = form.get('audio') as File | null;
      if (!audio || audio.size === 0) {
        return NextResponse.json({ error: 'لا يوجد مرفق صوتي' }, { status: 400 });
      }
      if (audio.size > AUDIO_MAX_BYTES) {
        return NextResponse.json({ error: 'الملف الصوتي كبير جداً' }, { status: 413 });
      }
      let text: string;
      try {
        text = await transcribeAudio(audio);
      } catch (err) {
        const msg = err instanceof SttError && err.code === 'NO_KEY'
          ? 'تحويل الصوت غير مفعّل حالياً. اكتبي رسالتك نصّاً من فضلك.'
          : 'تعذّر تحويل الرسالة الصوتية، اكتبيها نصّاً من فضلك.';
        return NextResponse.json({ error: msg }, { status: 503 });
      }
      body = {
        sessionId: form.get('sessionId')?.toString() ?? '',
        message: text,
        name:    form.get('name')?.toString()    ?? undefined,
        email:   form.get('email')?.toString()   ?? undefined,
        phone:   form.get('phone')?.toString()   ?? undefined,
        website: form.get('website')?.toString() ?? undefined,
      };
      transcribed = true;
    } catch {
      return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 });
    }
  } else {
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }
  }

  if (body.website && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, reply: '' }); // honeypot
  }

  const sessionId = (body.sessionId ?? '').trim().slice(0, 64);
  const message   = (body.message   ?? '').trim().slice(0, 2000);
  if (!sessionId) return NextResponse.json({ error: 'sessionId مطلوب' }, { status: 400 });
  if (!message)   return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });

  // ── Settings + assistant-enabled gate ──
  // Same toggle the FB webhook respects. If the owner disabled the
  // assistant globally, the chat shows a "currently offline"
  // response instead of trying to call a misconfigured AI.
  const settings = await getAssistantSettings();
  if (!settings.enabled) {
    return NextResponse.json({
      ok: true,
      reply: 'مساعد أمين متوقف مؤقتاً. تقدري تتواصلي معانا على واتساب أو تترك رسالة في صفحة التواصل.',
      leadStatus: 'cold',
      offline: true,
    });
  }
  // The same shouldAutoReply heuristic decides whether to engage.
  if (!shouldAutoReply(message, settings)) {
    return NextResponse.json({
      ok: true,
      reply: '...',
      leadStatus: 'cold',
      skipped: true,
    });
  }

  // ── Profile extraction + persistence (per-session) ──
  // Caller-supplied name/email/phone seed the profile so a
  // logged-in user gets personalised replies from message #1.
  const seeded: Partial<Parameters<typeof updateProfile>[1]> = {};
  if (body.name)  seeded.name  = body.name.trim().slice(0, 100);
  if (body.phone) seeded.phone = body.phone.trim().slice(0, 50);
  // email isn't on the FB profile shape but we store it under
  // name fallback for visibility in the admin inbox if no name.
  const fromMessage = extractFromMessage(message);
  const merged = await updateProfile(sessionId, { ...fromMessage, ...seeded });

  // ── Persist incoming event ──
  let stored;
  try {
    stored = await prisma.facebookEvent.create({
      data: {
        psid: sessionId,
        kind: 'website-chat',
        direction: 'incoming',
        text: message,
        sender: body.name ? { name: body.name.trim() } : undefined,
        rawPayload: { source: 'ameen-chat', ip, ua: req.headers.get('user-agent') ?? '' },
        customerName:    fromMessage.name        ?? body.name?.trim()  ?? null,
        customerPhone:   fromMessage.phone       ?? body.phone?.trim() ?? null,
        customerAddress: fromMessage.address     ?? null,
        customerGov:     fromMessage.governorate ?? null,
        kidAges:         fromMessage.kidAges && fromMessage.kidAges.length > 0
                           ? fromMessage.kidAges as unknown as object
                           : undefined,
        intentSignal:    fromMessage.intentSignal ?? null,
      },
    });
  } catch (err) {
    console.error('[ameen-chat] failed to persist incoming', err);
    return NextResponse.json({ error: 'حدث خطأ، حاول مرة أخرى' }, { status: 500 });
  }

  // ── History ──
  // Same scaling rule as the FB webhook: HOT conversations get
  // the deeper window (last 20 turns), cold get the cheap 6.
  const recentHot = await prisma.facebookEvent.findFirst({
    where: {
      psid: sessionId,
      kind: 'website-chat',
      leadStatus: 'hot',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
    select: { id: true },
  });
  const take = recentHot ? 20 : 6;
  const recent = await prisma.facebookEvent.findMany({
    where: {
      psid: sessionId,
      kind: 'website-chat',
      id: { not: stored.id },
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: { direction: true, text: true },
  });
  const history = recent
    .reverse()
    .map(r => ({
      role: r.direction === 'incoming' ? 'user' as const : 'assistant' as const,
      content: r.text,
    }));

  // ── Build prompt + call AI ──
  const context = await buildAssistantContext();
  const profileBlock = renderProfileForPrompt(merged);
  const enrichedPrompt =
    `${settings.systemPrompt}\n\n` +
    `## ملاحظة عن القناة (موقع مسلم ليدر):\n` +
    `الردود تظهر في دردشة على https://moslimleader.com.\n\n` +
    `### قواعد إضافية لرد الموقع — التزمي بها بدقة:\n` +
    `1. **سؤال تأهيلي قبل الترشيح:** لو لسه ما عرفتيش (الجنس/العمر/هل الكتاب هدية ولا للقراءة اليومية/هل الطفل هيقرا لوحده ولا مع الأم)، اسألي **سؤال واحد مختصر** قبل أي ترشيح. مرة واحدة فقط، بعدين رشّحي.\n` +
    `2. **منتج واحد فقط في كل رد** (إلا لو طلبت العميلة مقارنة صريحة). الكثرة بتشتّت.\n` +
    `3. **صيغة الرابط الإلزامية:** اكتبي رابط المنتج في سطر منفصل بصيغة بسيطة بدون markdown:\n` +
    `   ✅ "https://moslimleader.com/shop/SLUG"\n` +
    `   ❌ "[رابط المنتج](moslimleader.com/shop/SLUG)" — هذه الصيغة لا تظهر بشكل صحيح في الواجهة.\n` +
    `4. **زر السلة:** الواجهة هتعرض كرت المنتج مع زر "أضف للسلة" تحت رسالتك تلقائياً، فاكتفي بسطر واحد لتعريف المنتج، ثم الرابط، ثم سؤال الإغلاق.\n` +
    `5. **سؤال الإغلاق إلزامي في كل رد بعد الترشيح:** اختاري واحد:\n` +
    `   - "تحبي تضيفيه للسلة دلوقتي؟ هتلاقي زر السلة تحت."\n` +
    `   - "تحبي أحجزلك نسخة دلوقتي؟ ابعتيلي رقمك والعنوان."\n` +
    `   - "تحبي تشوفي الـ ${'{N}'} صفحة المعاينة المجانية الأول؟"\n` +
    `6. **لو الرد مجرد ترحيب أو سؤال تأهيلي، السؤال نفسه هو الإغلاق** — لا تحتاجي صيغة إضافية.\n\n` +
    (profileBlock ? `${profileBlock}\n\n` : '') +
    `---\n\n${context.text}`;

  let rawAiText: string;
  let aiTokens = 0;
  try {
    const result = await callAi(settings.provider, settings.apiKeys, {
      systemPrompt: enrichedPrompt,
      userMessage: message,
      history,
      model: settings.model,
      maxTokens: settings.maxTokens,
    });
    rawAiText = result.text;
    aiTokens = result.totalTokens;
  } catch (err) {
    // Persist the failure for the admin's audit trail and respond
    // with a graceful fallback — same UX behaviour as the FB
    // webhook so users see "back in a minute" instead of silence.
    await prisma.facebookEvent.create({
      data: {
        psid: sessionId,
        kind: 'website-chat',
        direction: 'outgoing-auto',
        text: '',
        aiModel: settings.model,
        sendStatus: 'failed',
        sendError: err instanceof Error ? err.message : String(err),
      },
    }).catch(() => {/* swallow */});
    await prisma.setting.upsert({
      where: { key: `needs-attention:${sessionId}` },
      create: { key: `needs-attention:${sessionId}`, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    }).catch(() => {/* swallow */});
    return NextResponse.json({
      ok: true,
      reply: 'حصل تأخر بسيط من جانبنا — حاول مرة أخرى أو راسلنا على واتساب 🙏',
      leadStatus: 'cold',
      error: true,
    });
  }

  const { cleanText: aiText, leadStatus, intent } = extractLeadTag(rawAiText);

  // Persist the outgoing reply.
  await prisma.facebookEvent.create({
    data: {
      psid: sessionId,
      kind: 'website-chat',
      direction: 'outgoing-auto',
      text: aiText,
      aiModel: settings.model,
      aiTokens,
      sendStatus: 'sent',
      leadStatus,
      intentSignal: intent,
    },
  }).catch(err => {
    console.error('[ameen-chat] failed to persist reply', err);
  });

  return NextResponse.json({
    ok: true,
    reply: aiText,
    leadStatus,
    intent,
    transcript: transcribed ? message : undefined,
    profile: {
      name: merged.name,
      phone: merged.phone,
      governorate: merged.governorate,
      kidAges: merged.kidAges,
    },
  });
}
