export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import {
  getAssistantSettings,
  saveAssistantSettings,
  type AssistantSettings,
} from '@/lib/ai-facebook-assistant';

// GET /api/admin/ai-facebook-assistant
//   Returns current settings + a flat list of recent FacebookEvents
//   grouped into conversations (per psid).
//
// PUT /api/admin/ai-facebook-assistant
//   Persists tweaked settings (toggle, system prompt, model, etc.).
//
// Both gated on `settings.write` — assistant config is sensitive
// (governs what the bot says publicly under the brand name) and we
// don't want every staff member with a perm to flip the switch.

export async function GET() {
  const guard = await requirePerm('settings.read');
  if ('response' in guard) return guard.response;

  const [settings, recent] = await Promise.all([
    getAssistantSettings(),
    prisma.facebookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        psid: true,
        direction: true,
        text: true,
        sender: true,
        aiModel: true,
        aiTokens: true,
        sendStatus: true,
        sendError: true,
        createdAt: true,
      },
    }),
  ]);

  // Group by psid so the UI can render each user as a thread.
  type EventRow = (typeof recent)[number];
  const conversationsMap = new Map<string, EventRow[]>();
  for (const e of recent) {
    const list = conversationsMap.get(e.psid);
    if (list) list.push(e);
    else conversationsMap.set(e.psid, [e]);
  }
  const conversations = Array.from(conversationsMap.entries())
    .map(([psid, events]) => {
      // Pull the user's display name from the most recent incoming
      // event (Facebook supplies a `sender.name` only sometimes).
      const incoming = events.find(e => e.direction === 'incoming');
      const senderObj = incoming?.sender as { name?: string } | null | undefined;
      return {
        psid,
        userName: senderObj?.name ?? null,
        lastAt: events[0].createdAt.toISOString(),
        eventCount: events.length,
        events: events.map(e => ({
          id: e.id,
          direction: e.direction,
          text: e.text,
          aiModel: e.aiModel,
          sendStatus: e.sendStatus,
          sendError: e.sendError,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  // Status flags so the UI can show "missing token" warnings up front.
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  const hasPageToken =
    !!process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_PAGE_ACCESS_TOKEN !== 'PENDING';
  const hasAppSecret =
    !!(process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET);

  return NextResponse.json({
    settings,
    conversations,
    integrationStatus: {
      hasOpenAiKey,
      hasPageToken,
      hasAppSecret,
    },
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requirePerm('settings.write');
  if ('response' in guard) return guard.response;

  let body: Partial<AssistantSettings>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const before = await getAssistantSettings();
  const saved = await saveAssistantSettings(body);
  await logActionSafe({
    actor: guard.user,
    action: 'settings.update',
    entity: 'Setting',
    entityId: 'ai-facebook-assistant',
    before,
    after: saved,
  });
  return NextResponse.json({ ok: true, settings: saved });
}
