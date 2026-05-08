import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SETTING_KEY = 'facebook-assistant';

export interface FacebookAssistantSettings {
  isEnabled: boolean;
  messengerEnabled: boolean;
  commentsEnabled: boolean;
  replyMode: 'draft' | 'auto';
  tone: 'warm' | 'formal' | 'sales';
  dailyLimit: number;
  escalationKeywords: string;
  pageAccessToken: string; // stored server-side only, never returned to client
}

const DEFAULTS: FacebookAssistantSettings = {
  isEnabled: false,
  messengerEnabled: true,
  commentsEnabled: false,
  replyMode: 'draft',
  tone: 'warm',
  dailyLimit: 50,
  escalationKeywords: 'شكوى,غالي,لم يصل,استرجاع,نصب,إلغاء,مشكلة',
  pageAccessToken: '',
};

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  const settings = row ? (row.value as unknown as FacebookAssistantSettings) : DEFAULTS;

  // Never expose the page access token to the frontend
  const { pageAccessToken: _, ...safeSettings } = settings;
  const hasToken = !!(settings.pageAccessToken);

  return NextResponse.json({ settings: { ...safeSettings, hasToken } });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  // Load existing to preserve pageAccessToken if not being updated
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  const existing = row ? (row.value as unknown as FacebookAssistantSettings) : DEFAULTS;

  const updated: FacebookAssistantSettings = {
    isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : existing.isEnabled,
    messengerEnabled: typeof body.messengerEnabled === 'boolean' ? body.messengerEnabled : existing.messengerEnabled,
    commentsEnabled: typeof body.commentsEnabled === 'boolean' ? body.commentsEnabled : existing.commentsEnabled,
    replyMode: ['draft', 'auto'].includes(body.replyMode) ? body.replyMode : existing.replyMode,
    tone: ['warm', 'formal', 'sales'].includes(body.tone) ? body.tone : existing.tone,
    dailyLimit: typeof body.dailyLimit === 'number' && body.dailyLimit > 0 ? body.dailyLimit : existing.dailyLimit,
    escalationKeywords: typeof body.escalationKeywords === 'string' ? body.escalationKeywords : existing.escalationKeywords,
    // Only update token if a non-empty value was explicitly provided
    pageAccessToken: typeof body.pageAccessToken === 'string' && body.pageAccessToken.trim()
      ? body.pageAccessToken.trim()
      : existing.pageAccessToken,
  };

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: updated as unknown as object },
    update: { value: updated as unknown as object },
  });

  const { pageAccessToken: _, ...safeSettings } = updated;
  return NextResponse.json({ settings: { ...safeSettings, hasToken: !!updated.pageAccessToken } });
}
