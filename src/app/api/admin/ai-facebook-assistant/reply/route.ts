export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { sendFacebookReply, replyToComment } from '@/lib/ai-facebook-assistant';

// Admin manually sends a reply. Body must include `psid` (so we can
// thread the response in the inbox) PLUS either `commentId` (reply
// to a public comment via Graph API) or nothing (default → Messenger
// DM via Send API).
export async function POST(req: NextRequest) {
  const guard = await requirePerm('settings.write');
  if ('response' in guard) return guard.response;

  let body: { psid?: string; text?: string; commentId?: string; postId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const psid = body.psid?.trim();
  const text = body.text?.trim();
  const commentId = body.commentId?.trim() || null;
  const postId = body.postId?.trim() || null;
  if (!psid) return NextResponse.json({ error: 'psid مطلوب' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });

  const isComment = !!commentId;
  const sendResult = isComment
    ? await replyToComment(commentId!, text)
    : await sendFacebookReply(psid, text);

  const stored = await prisma.facebookEvent.create({
    data: {
      psid,
      kind: isComment ? 'comment' : 'message',
      direction: 'outgoing-manual',
      text,
      commentId,
      postId,
      sendStatus: sendResult.ok ? 'sent' : 'failed',
      sendError: sendResult.ok ? null : sendResult.error ?? 'unknown',
    },
  });

  await logActionSafe({
    actor: guard.user,
    action: 'settings.update',
    entity: 'FacebookEvent',
    entityId: stored.id,
    metadata: { psid, kind: isComment ? 'comment' : 'message', sent: sendResult.ok },
  });

  if (!sendResult.ok) {
    return NextResponse.json({ ok: false, error: sendResult.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
