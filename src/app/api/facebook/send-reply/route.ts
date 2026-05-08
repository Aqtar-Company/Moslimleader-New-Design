import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { FacebookAssistantSettings } from '@/app/api/admin/ai-facebook-assistant/settings/route';

export const dynamic = 'force-dynamic';

// POST /api/facebook/send-reply
// Sends the approved AI reply to Facebook via Graph API and marks message as sent.
export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { messageId, replyText } = body as { messageId: string; replyText?: string };

  if (!messageId) {
    return NextResponse.json({ error: 'messageId required' }, { status: 400 });
  }

  const message = await prisma.facebookMessage.findUnique({
    where: { id: messageId },
    include: { conversation: true },
  });

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const textToSend = replyText ?? message.aiReply;
  if (!textToSend) {
    return NextResponse.json({ error: 'No reply text available' }, { status: 400 });
  }

  // Load page access token from settings (never from client)
  const settingRow = await prisma.setting.findUnique({ where: { key: 'facebook-assistant' } });
  if (!settingRow) {
    return NextResponse.json({ error: 'Assistant not configured' }, { status: 400 });
  }
  const settings = settingRow.value as unknown as FacebookAssistantSettings;
  const pageToken = settings.pageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageToken) {
    return NextResponse.json({ error: 'Facebook Page Access Token not configured' }, { status: 400 });
  }

  let metaResponse: string;
  let success = false;

  try {
    if (message.source === 'comment') {
      // Reply to a comment via comment_id
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${message.messageId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: textToSend, access_token: pageToken }),
        }
      );
      const data = await res.json();
      metaResponse = JSON.stringify(data);
      success = !!data.id;
    } else {
      // Send Messenger reply via PSID
      const senderId = message.conversation.senderId;
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: textToSend },
          }),
        }
      );
      const data = await res.json();
      metaResponse = JSON.stringify(data);
      success = !!data.message_id;
    }
  } catch (err) {
    metaResponse = err instanceof Error ? err.message : 'Network error';
  }

  await prisma.facebookMessage.update({
    where: { id: messageId },
    data: {
      aiReply: textToSend,
      status: success ? 'sent' : 'failed',
      sentAt: success ? new Date() : null,
      metaResponse,
    },
  });

  if (!success) {
    return NextResponse.json({ error: 'Failed to send via Facebook API', detail: metaResponse }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
