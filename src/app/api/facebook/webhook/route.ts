export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAssistantSettings,
  verifyFacebookSignature,
  callOpenAI,
  sendFacebookReply,
  shouldAutoReply,
} from '@/lib/ai-facebook-assistant';

// Facebook / Instagram webhook endpoint.
//
// GET = verification handshake (echoes hub.challenge when token matches).
// POST = real events. We:
//   1. Verify HMAC signature against FB_APP_SECRET
//   2. Persist incoming events to FacebookEvent (audit trail)
//   3. If auto-reply enabled → call OpenAI → POST to Send API → log reply

const VERIFY_TOKEN =
  process.env.FB_VERIFY_TOKEN ||
  process.env.FACEBOOK_VERIFY_TOKEN ||
  'ml_webhook_2026';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

interface FbMessagingEntry {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean };
  postback?: { payload?: string; title?: string };
  timestamp?: number;
}
interface FbEntry {
  id?: string;
  time?: number;
  messaging?: FbMessagingEntry[];
}

export async function POST(req: NextRequest) {
  // Read body as raw text — needed for HMAC verification, since
  // re-stringifying parsed JSON can change byte order vs what FB signed.
  let raw = '';
  try { raw = await req.text(); } catch { /* tolerate */ }

  // 1. Signature gate.
  const signature = req.headers.get('x-hub-signature-256');
  const ok = verifyFacebookSignature(raw, signature);
  if (!ok) {
    // 200 still — Facebook will retry on non-200 and we want to drop
    // bogus payloads silently rather than expose verify failures.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fb-webhook] signature mismatch — dropping');
    }
    return NextResponse.json({ received: true });
  }

  // 2. Parse + dispatch each messaging entry.
  let payload: { entry?: FbEntry[] } = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* leave empty */ }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const m of messaging) {
      // Skip echoes (page sending its own message — we already logged it
      // when we sent it).
      if (m.message?.is_echo) continue;
      const psid = m.sender?.id;
      if (!psid) continue;

      // Either a free-text message or a postback (button click).
      const text =
        m.message?.text?.trim() ||
        (m.postback?.payload ? `[postback] ${m.postback.title || m.postback.payload}` : '');
      if (!text) continue;

      await handleIncoming({
        psid,
        text,
        sender: m.sender ?? null,
        recipient: m.recipient ?? null,
        rawPayload: m,
      });
    }
  }

  return NextResponse.json({ received: true });
}

interface IncomingInput {
  psid: string;
  text: string;
  sender: object | null;
  recipient: object | null;
  rawPayload: object;
}

async function handleIncoming(input: IncomingInput) {
  // Persist the incoming event first — we want the record even if
  // the AI / Send API legs fail downstream.
  let stored;
  try {
    stored = await prisma.facebookEvent.create({
      data: {
        psid: input.psid,
        direction: 'incoming',
        text: input.text,
        sender: input.sender ?? undefined,
        recipient: input.recipient ?? undefined,
        rawPayload: input.rawPayload,
      },
    });
  } catch (err) {
    console.error('[fb-webhook] failed to persist incoming', err);
    return;
  }

  // Decide whether to auto-reply. Falls through silently when the
  // assistant is disabled, or when the message doesn't match the
  // configured trigger keywords.
  const settings = await getAssistantSettings();
  if (!shouldAutoReply(input.text, settings)) return;

  // Build a small history window from this user's last 6 messages so
  // the bot answers in context (multi-turn conversation).
  const recent = await prisma.facebookEvent.findMany({
    where: { psid: input.psid, id: { not: stored.id } },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { direction: true, text: true },
  });
  const history = recent
    .reverse()
    .map(r => ({
      role: r.direction === 'incoming' ? 'user' as const : 'assistant' as const,
      content: r.text,
    }));

  let aiText: string;
  let aiTokens = 0;
  try {
    const result = await callOpenAI({
      systemPrompt: settings.systemPrompt,
      userMessage: input.text,
      history,
      model: settings.model,
      maxTokens: settings.maxTokens,
    });
    aiText = result.text;
    aiTokens = result.totalTokens;
  } catch (err) {
    console.error('[fb-webhook] AI call failed', err);
    // Persist a failed-outgoing row so the admin can see why.
    await prisma.facebookEvent.create({
      data: {
        psid: input.psid,
        direction: 'outgoing-auto',
        text: '',
        aiModel: settings.model,
        sendStatus: 'failed',
        sendError: err instanceof Error ? err.message : String(err),
      },
    }).catch(() => {/* swallow */});
    return;
  }

  const sendResult = await sendFacebookReply(input.psid, aiText);
  await prisma.facebookEvent.create({
    data: {
      psid: input.psid,
      direction: 'outgoing-auto',
      text: aiText,
      aiModel: settings.model,
      aiTokens,
      sendStatus: sendResult.ok ? 'sent' : 'failed',
      sendError: sendResult.ok ? null : sendResult.error ?? 'unknown',
    },
  }).catch(err => {
    console.error('[fb-webhook] failed to persist reply', err);
  });
}
