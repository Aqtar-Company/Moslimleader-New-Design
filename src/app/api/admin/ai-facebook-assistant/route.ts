export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, requireSuperAdmin } from '@/lib/permissions';
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
  const guard = await requirePerm('ai-assistant.read');
  if ('response' in guard) return guard.response;

  const [settings, recent] = await Promise.all([
    getAssistantSettings(),
    prisma.facebookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        psid: true,
        kind: true,
        direction: true,
        text: true,
        commentId: true,
        postId: true,
        sender: true,
        aiModel: true,
        aiTokens: true,
        sendStatus: true,
        sendError: true,
        leadStatus: true,
        userGender: true,
        // Sales-conversion fields (extracted by conversation-extractor).
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        customerGov: true,
        kidAges: true,
        intentSignal: true,
        createdAt: true,
      },
    }),
  ]);

  // Group by `psid + kind` so a user who messages AND comments shows
  // up as TWO separate threads (different reply mechanism per kind).
  type EventRow = (typeof recent)[number];
  const conversationsMap = new Map<string, EventRow[]>();
  for (const e of recent) {
    const key = `${e.kind}:${e.psid}`;
    const list = conversationsMap.get(key);
    if (list) list.push(e);
    else conversationsMap.set(key, [e]);
  }
  // Roll up the "hottest" lead status across all events in a thread
  // — HOT > WARM > COLD. Lets the inbox sort by intent at a glance.
  const LEAD_RANK: Record<string, number> = { hot: 3, warm: 2, cold: 1 };
  // Pull "needs-attention" flags (set when AI errored out) so the
  // inbox can render the 🛎️ chip on affected conversations.
  const needsAttentionRows = await prisma.setting.findMany({
    where: { key: { startsWith: 'needs-attention:' } },
    select: { key: true, value: true },
  }).catch(() => []);
  const needsAttentionMap = new Map<string, string>();
  for (const r of needsAttentionRows) {
    const psid = r.key.slice('needs-attention:'.length);
    needsAttentionMap.set(psid, typeof r.value === 'string' ? r.value : '');
  }
  const muteRows = await prisma.setting.findMany({
    where: { key: { startsWith: 'mute-psid-' } },
    select: { key: true },
  }).catch(() => []);
  const mutedPsids = new Set(muteRows.map(r => r.key.slice('mute-psid-'.length)));

  const conversations = Array.from(conversationsMap.entries())
    .map(([key, events]) => {
      const [kind, psid] = key.split(':');
      const incoming = events.find(e => e.direction === 'incoming');
      const senderObj = incoming?.sender as { name?: string } | null | undefined;
      const lastIncomingComment = events.find(e => e.direction === 'incoming' && e.kind === 'comment');
      let topLead: 'hot' | 'warm' | 'cold' | null = null;
      let topRank = 0;
      for (const e of events) {
        if (!e.leadStatus) continue;
        const rank = LEAD_RANK[e.leadStatus] ?? 0;
        if (rank > topRank) { topRank = rank; topLead = e.leadStatus as 'hot' | 'warm' | 'cold'; }
      }
      const userGender = events.find(e => e.userGender)?.userGender ?? null;
      // Build a per-conversation "extracted profile" by walking
      // events newest-first and taking the first non-null value
      // for each field. This mirrors what the bot sees on every
      // turn (the per-psid Setting profile) but keeps the UI
      // self-contained.
      let customerName    : string | null = null;
      let customerPhone   : string | null = null;
      let customerAddress : string | null = null;
      let customerGov     : string | null = null;
      let kidAges         : number[] = [];
      let lastIntent      : string | null = null;
      for (const e of events) {
        if (!customerName    && e.customerName)    customerName    = e.customerName;
        if (!customerPhone   && e.customerPhone)   customerPhone   = e.customerPhone;
        if (!customerAddress && e.customerAddress) customerAddress = e.customerAddress;
        if (!customerGov     && e.customerGov)     customerGov     = e.customerGov;
        if (kidAges.length === 0 && Array.isArray(e.kidAges)) kidAges = e.kidAges as number[];
        if (!lastIntent      && e.intentSignal)    lastIntent      = e.intentSignal;
      }
      return {
        key,
        kind,
        psid,
        userName: senderObj?.name ?? customerName ?? null,
        userGender,
        lastAt: events[0].createdAt.toISOString(),
        eventCount: events.length,
        leadStatus: topLead,
        commentId: lastIncomingComment?.commentId ?? null,
        postId: lastIncomingComment?.postId ?? null,
        muted: mutedPsids.has(psid),
        needsAttention: needsAttentionMap.has(psid),
        // Extracted buyer profile rolled up from the thread.
        profile: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
          governorate: customerGov,
          kidAges,
          lastIntent,
        },
        events: events.map(e => ({
          id: e.id,
          kind: e.kind,
          direction: e.direction,
          text: e.text,
          commentId: e.commentId,
          postId: e.postId,
          aiModel: e.aiModel,
          sendStatus: e.sendStatus,
          sendError: e.sendError,
          leadStatus: e.leadStatus,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    })
    .sort((a, b) => {
      // Sort: HOT leads first, then WARM, then by recency.
      const aRank = a.leadStatus ? LEAD_RANK[a.leadStatus] ?? 0 : 0;
      const bRank = b.leadStatus ? LEAD_RANK[b.leadStatus] ?? 0 : 0;
      if (aRank !== bRank) return bRank - aRank;
      return b.lastAt.localeCompare(a.lastAt);
    });

  // Status flags so the UI can show "missing token" warnings up
  // front. Each key is "present" if EITHER the admin-stored key OR
  // the env var is set — the runtime path uses the same fallback.
  const hasOpenAiKey   = !!(settings.apiKeys.openai    || process.env.OPENAI_API_KEY);
  const hasGeminiKey   = !!(settings.apiKeys.gemini    || process.env.GEMINI_API_KEY);
  const hasAnthropicKey = !!(settings.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY);
  const hasPageToken =
    !!process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_PAGE_ACCESS_TOKEN !== 'PENDING';
  const hasAppSecret =
    !!(process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET);

  // Strip the actual key values out of `settings` before returning —
  // even an admin shouldn't get the plaintext key in a JSON response.
  // We surface only "configured?" booleans per provider.
  const safeKeys = settings.apiKeys ?? {};
  const settingsSafe = {
    ...settings,
    apiKeys: {
      openai:    !!safeKeys.openai,
      gemini:    !!safeKeys.gemini,
      anthropic: !!safeKeys.anthropic,
    },
  };

  return NextResponse.json({
    settings: settingsSafe,
    conversations,
    integrationStatus: {
      hasOpenAiKey,
      hasGeminiKey,
      hasAnthropicKey,
      hasPageToken,
      hasAppSecret,
    },
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireSuperAdmin();
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
