export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

// Toggle per-conversation auto-reply mute. Used when the admin
// wants to take over a delicate conversation manually without
// disabling the bot globally. The webhook reads the same Setting
// key and skips auto-reply when it exists.
export async function POST(req: NextRequest) {
  const guard = await requirePerm(['settings.write', 'ai-assistant.write']);
  if ('response' in guard) return guard.response;

  let body: { psid?: string; mute?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const psid = body.psid?.trim();
  if (!psid) return NextResponse.json({ error: 'psid مطلوب' }, { status: 400 });

  const key = `mute-psid-${psid}`;
  if (body.mute) {
    await prisma.setting.upsert({
      where:  { key },
      create: { key, value: '1' },
      update: { value: '1' },
    });
  } else {
    await prisma.setting.delete({ where: { key } }).catch(() => {/* OK if absent */});
  }
  return NextResponse.json({ ok: true, muted: !!body.mute });
}
