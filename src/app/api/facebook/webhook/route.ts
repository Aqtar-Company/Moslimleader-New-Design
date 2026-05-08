import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';
import { FacebookAssistantSettings } from '@/app/api/admin/ai-facebook-assistant/settings/route';

export const dynamic = 'force-dynamic';

// GET — Meta webhook verification (hub.mode=subscribe challenge handshake)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? '';
  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST — Receive webhook events from Meta
export async function POST(req: NextRequest) {
  // Verify X-Hub-Signature-256 if app secret is configured
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? '';
  if (appSecret) {
    const rawBody = await req.text();
    const sig = req.headers.get('x-hub-signature-256') ?? '';
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    if (sig !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    // Re-parse since we consumed the stream
    try {
      await handlePayload(JSON.parse(rawBody));
    } catch {
      // swallow — return 200 so Meta doesn't retry endlessly
    }
    return NextResponse.json({ ok: true });
  }

  // No app secret configured — parse normally
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    await handlePayload(body);
  } catch {
    // swallow
  }

  return NextResponse.json({ ok: true });
}

async function handlePayload(body: unknown) {
  if (!body || typeof body !== 'object') return;
  const payload = body as Record<string, unknown>;

  // Check if the assistant is enabled
  const settingRow = await prisma.setting.findUnique({ where: { key: 'facebook-assistant' } });
  if (!settingRow) return;
  const settings = settingRow.value as unknown as FacebookAssistantSettings;
  if (!settings.isEnabled) return;

  const entries = (payload.entry ?? []) as Array<Record<string, unknown>>;

  for (const entry of entries) {
    // Messenger messages
    if (settings.messengerEnabled) {
      const messaging = (entry.messaging ?? []) as Array<Record<string, unknown>>;
      for (const event of messaging) {
        await processMessengerEvent(event, settings);
      }
    }

    // Page post comments
    if (settings.commentsEnabled) {
      const changes = (entry.changes ?? []) as Array<Record<string, unknown>>;
      for (const change of changes) {
        if (change.field === 'feed') {
          await processCommentEvent(change.value as Record<string, unknown>, settings);
        }
      }
    }
  }
}

async function processMessengerEvent(
  event: Record<string, unknown>,
  settings: FacebookAssistantSettings
) {
  const sender = event.sender as Record<string, unknown> | undefined;
  const message = event.message as Record<string, unknown> | undefined;
  if (!sender?.id || !message?.text) return;

  const senderId = String(sender.id);
  const messageId = String(message.mid ?? `${senderId}-${Date.now()}`);
  const text = String(message.text);

  // Dedup: skip if this Meta message ID was already processed
  const existing = await prisma.facebookWebhookEvent.findUnique({ where: { eventId: messageId } });
  if (existing) return;

  // Record raw event
  await prisma.facebookWebhookEvent.create({
    data: {
      eventId: messageId,
      eventType: 'message',
      payload: JSON.stringify(event),
      processed: false,
    },
  });

  // Upsert conversation
  let conversation = await prisma.facebookConversation.findFirst({ where: { senderId } });
  if (!conversation) {
    conversation = await prisma.facebookConversation.create({
      data: { senderId, source: 'messenger', status: 'open' },
    });
  }

  // Detect escalation keywords
  const keywords = settings.escalationKeywords.split(',').map(k => k.trim()).filter(Boolean);
  const shouldEscalate = keywords.some(k => text.includes(k));

  const msgRecord = await prisma.facebookMessage.create({
    data: {
      conversationId: conversation.id,
      messageId,
      direction: 'incoming',
      text,
      source: 'messenger',
      status: shouldEscalate ? 'escalated' : 'draft',
    },
  });

  // Mark webhook event processed
  await prisma.facebookWebhookEvent.update({
    where: { eventId: messageId },
    data: { processed: true },
  });

  // Generate AI reply draft in the background (fire-and-forget)
  if (!shouldEscalate) {
    generateAiDraft(msgRecord.id, text, settings).catch(() => {});
  }
}

async function processCommentEvent(
  value: Record<string, unknown>,
  settings: FacebookAssistantSettings
) {
  if (value.item !== 'comment') return;
  const senderId = String((value.from as Record<string, unknown>)?.id ?? 'unknown');
  const commentId = String(value.comment_id ?? `${senderId}-${Date.now()}`);
  const text = String(value.message ?? '');
  const postId = String(value.post_id ?? '');

  if (!text) return;

  const existing = await prisma.facebookWebhookEvent.findUnique({ where: { eventId: commentId } });
  if (existing) return;

  await prisma.facebookWebhookEvent.create({
    data: { eventId: commentId, eventType: 'comment', payload: JSON.stringify(value), processed: false },
  });

  let conversation = await prisma.facebookConversation.findFirst({ where: { senderId, source: 'comment' } });
  if (!conversation) {
    conversation = await prisma.facebookConversation.create({
      data: { senderId, source: 'comment', postId, status: 'open' },
    });
  }

  const keywords = settings.escalationKeywords.split(',').map(k => k.trim()).filter(Boolean);
  const shouldEscalate = keywords.some(k => text.includes(k));

  const msgRecord = await prisma.facebookMessage.create({
    data: {
      conversationId: conversation.id,
      messageId: commentId,
      direction: 'incoming',
      text,
      source: 'comment',
      status: shouldEscalate ? 'escalated' : 'draft',
    },
  });

  await prisma.facebookWebhookEvent.update({
    where: { eventId: commentId },
    data: { processed: true },
  });

  if (!shouldEscalate) {
    generateAiDraft(msgRecord.id, text, settings).catch(() => {});
  }
}

async function generateAiDraft(messageId: string, text: string, settings: FacebookAssistantSettings) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/ai/facebook-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' },
      body: JSON.stringify({ messageId, text, tone: settings.tone, source: 'messenger' }),
    });
    if (!res.ok) throw new Error(`AI reply failed: ${res.status}`);
  } catch {
    // Non-fatal — admin can regenerate from the inbox
  }
}
