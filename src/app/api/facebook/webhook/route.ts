export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAssistantSettings,
  verifyFacebookSignature,
  callAi,
  sendFacebookReply,
  replyToComment,
  shouldAutoReply,
} from '@/lib/ai-facebook-assistant';

// Facebook / Instagram webhook endpoint — handles BOTH:
//   • Messenger DMs (entry.messaging[])
//   • Page feed events including comments (entry.changes[] with field=feed)
//
// GET = verification handshake. POST = events.

const VERIFY_TOKEN =
  process.env.FB_VERIFY_TOKEN ||
  process.env.FACEBOOK_VERIFY_TOKEN ||
  'ml_webhook_2026';

// Cache the page id once; it's used to skip echoes from the page
// commenting on its own posts (the page itself shows up as a "from"
// on outgoing replies, and we don't want to AI-reply to ourselves).
const PAGE_ID = process.env.FB_PAGE_ID || '';

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

interface FbFeedChange {
  field?: string;
  value?: {
    item?: string; // 'comment' | 'post' | 'reaction' | ...
    verb?: string; // 'add' | 'edit' | 'remove'
    comment_id?: string;
    post_id?: string;
    parent_id?: string;
    message?: string;
    from?: { id?: string; name?: string };
    created_time?: number;
  };
}

interface FbEntry {
  id?: string;
  time?: number;
  messaging?: FbMessagingEntry[];
  changes?: FbFeedChange[];
}

export async function POST(req: NextRequest) {
  let raw = '';
  try { raw = await req.text(); } catch { /* tolerate */ }

  // Signature gate.
  const signature = req.headers.get('x-hub-signature-256');
  const ok = verifyFacebookSignature(raw, signature);
  if (!ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[fb-webhook] signature mismatch — dropping');
    }
    return NextResponse.json({ received: true });
  }

  let payload: { entry?: FbEntry[] } = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* leave empty */ }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    // 1. Messenger DMs
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const m of messaging) {
      if (m.message?.is_echo) continue;
      const psid = m.sender?.id;
      if (!psid) continue;
      const text =
        m.message?.text?.trim() ||
        (m.postback?.payload ? `[postback] ${m.postback.title || m.postback.payload}` : '');
      if (!text) continue;

      await handleIncomingMessage({
        psid,
        text,
        sender: m.sender ?? null,
        recipient: m.recipient ?? null,
        rawPayload: m,
      });
    }

    // 2. Page feed events (comments).
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const c of changes) {
      if (c.field !== 'feed') continue;
      const v = c.value;
      if (!v) continue;
      // Only react to NEW comments. Edits/removes are noise for the
      // auto-reply use case (the AI shouldn't re-reply to an edit).
      if (v.item !== 'comment') continue;
      if (v.verb && v.verb !== 'add') continue;
      // Skip the page commenting on its own posts (echo case).
      if (v.from?.id && PAGE_ID && v.from.id === PAGE_ID) continue;

      const commentId = v.comment_id;
      const text = v.message?.trim();
      const fromId = v.from?.id;
      if (!commentId || !text || !fromId) continue;

      await handleIncomingComment({
        commenterId: fromId,
        commenterName: v.from?.name ?? null,
        commentId,
        postId: v.post_id ?? null,
        text,
        rawPayload: c,
      });
    }
  }

  return NextResponse.json({ received: true });
}

interface IncomingMessageInput {
  psid: string;
  text: string;
  sender: object | null;
  recipient: object | null;
  rawPayload: object;
}

async function handleIncomingMessage(input: IncomingMessageInput) {
  let stored;
  try {
    stored = await prisma.facebookEvent.create({
      data: {
        psid: input.psid,
        kind: 'message',
        direction: 'incoming',
        text: input.text,
        sender: input.sender ?? undefined,
        recipient: input.recipient ?? undefined,
        rawPayload: input.rawPayload,
      },
    });
  } catch (err) {
    console.error('[fb-webhook] failed to persist incoming message', err);
    return;
  }

  const settings = await getAssistantSettings();
  if (!shouldAutoReply(input.text, settings)) return;

  const recent = await prisma.facebookEvent.findMany({
    where: {
      psid: input.psid,
      kind: 'message',
      id: { not: stored.id },
    },
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
    const result = await callAi(settings.provider, {
      systemPrompt: settings.systemPrompt,
      userMessage: input.text,
      history,
      model: settings.model,
      maxTokens: settings.maxTokens,
    });
    aiText = result.text;
    aiTokens = result.totalTokens;
  } catch (err) {
    await prisma.facebookEvent.create({
      data: {
        psid: input.psid,
        kind: 'message',
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
      kind: 'message',
      direction: 'outgoing-auto',
      text: aiText,
      aiModel: settings.model,
      aiTokens,
      sendStatus: sendResult.ok ? 'sent' : 'failed',
      sendError: sendResult.ok ? null : sendResult.error ?? 'unknown',
    },
  }).catch(err => {
    console.error('[fb-webhook] failed to persist message reply', err);
  });
}

interface IncomingCommentInput {
  commenterId: string;
  commenterName: string | null;
  commentId: string;
  postId: string | null;
  text: string;
  rawPayload: object;
}

async function handleIncomingComment(input: IncomingCommentInput) {
  let stored;
  try {
    stored = await prisma.facebookEvent.create({
      data: {
        psid: input.commenterId,
        kind: 'comment',
        direction: 'incoming',
        text: input.text,
        commentId: input.commentId,
        postId: input.postId,
        sender: input.commenterName ? { id: input.commenterId, name: input.commenterName } : { id: input.commenterId },
        rawPayload: input.rawPayload,
      },
    });
  } catch (err) {
    console.error('[fb-webhook] failed to persist incoming comment', err);
    return;
  }

  const settings = await getAssistantSettings();
  if (!shouldAutoReply(input.text, settings)) return;

  // Comments don't get conversation history (each comment is
  // independent and public). Just call the model with the prompt
  // + the user's comment text.
  let aiText: string;
  let aiTokens = 0;
  try {
    const result = await callAi(settings.provider, {
      systemPrompt:
        settings.systemPrompt +
        '\n\nملاحظة: هذا تعليق على بوست عام، الرد سيظهر للجميع. خلِّ الرد قصير جداً (جملة-جملتين كحد أقصى) ومهذّب.',
      userMessage: input.text,
      model: settings.model,
      maxTokens: Math.min(settings.maxTokens, 200),
    });
    aiText = result.text;
    aiTokens = result.totalTokens;
  } catch (err) {
    await prisma.facebookEvent.create({
      data: {
        psid: input.commenterId,
        kind: 'comment',
        direction: 'outgoing-auto',
        text: '',
        commentId: input.commentId,
        postId: input.postId,
        aiModel: settings.model,
        sendStatus: 'failed',
        sendError: err instanceof Error ? err.message : String(err),
      },
    }).catch(() => {/* swallow */});
    return;
  }

  const sendResult = await replyToComment(input.commentId, aiText);
  await prisma.facebookEvent.create({
    data: {
      psid: input.commenterId,
      kind: 'comment',
      direction: 'outgoing-auto',
      text: aiText,
      commentId: input.commentId,
      postId: input.postId,
      aiModel: settings.model,
      aiTokens,
      sendStatus: sendResult.ok ? 'sent' : 'failed',
      sendError: sendResult.ok ? null : sendResult.error ?? 'unknown',
    },
  }).catch(err => {
    console.error('[fb-webhook] failed to persist comment reply', err);
  });
}
