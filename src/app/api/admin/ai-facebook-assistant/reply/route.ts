export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { sendFacebookReply } from '@/lib/ai-facebook-assistant';

// Admin manually sends a reply on a conversation. Used when the owner
// wants to handle a message themselves instead of letting the AI reply
// (or to add a follow-up after the bot's auto-reply). The reply lands
// in FacebookEvent with direction = 'outgoing-manual' so the audit
// trail still distinguishes who sent what.
export async function POST(req: NextRequest) {
  const guard = await requirePerm('settings.write');
  if ('response' in guard) return guard.response;

  let body: { psid?: string; text?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const psid = body.psid?.trim();
  const text = body.text?.trim();
  if (!psid) return NextResponse.json({ error: 'psid مطلوب' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });

  const sendResult = await sendFacebookReply(psid, text);
  const stored = await prisma.facebookEvent.create({
    data: {
      psid,
      direction: 'outgoing-manual',
      text,
      sendStatus: sendResult.ok ? 'sent' : 'failed',
      sendError: sendResult.ok ? null : sendResult.error ?? 'unknown',
    },
  });

  await logActionSafe({
    actor: guard.user,
    action: 'settings.update',
    entity: 'FacebookEvent',
    entityId: stored.id,
    metadata: { psid, sent: sendResult.ok },
  });

  if (!sendResult.ok) {
    return NextResponse.json({ ok: false, error: sendResult.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
