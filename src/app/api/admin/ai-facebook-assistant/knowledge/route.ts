export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import {
  buildAssistantContext,
  getAssistantFaqs,
  saveAssistantFaqs,
  invalidateAssistantContext,
} from '@/lib/assistant-knowledge';

// Surface the live knowledge snapshot the bot uses, plus let the
// owner edit the custom FAQ markdown that gets appended.

export async function GET() {
  const guard = await requirePerm('settings.read');
  if ('response' in guard) return guard.response;

  const [context, faqs] = await Promise.all([
    buildAssistantContext(),
    getAssistantFaqs(),
  ]);
  return NextResponse.json({ context, faqs });
}

export async function PUT(req: NextRequest) {
  const guard = await requirePerm('settings.write');
  if ('response' in guard) return guard.response;

  let body: { faqs?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const text = (body.faqs ?? '').toString();
  await saveAssistantFaqs(text);
  invalidateAssistantContext();

  await logActionSafe({
    actor: guard.user,
    action: 'settings.update',
    entity: 'Setting',
    entityId: 'assistant-faqs',
  });
  return NextResponse.json({ ok: true });
}
