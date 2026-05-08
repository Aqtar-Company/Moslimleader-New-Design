export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requirePerm } from '@/lib/permissions';
import { getAssistantSettings, callOpenAI } from '@/lib/ai-facebook-assistant';

// Test the assistant — admin sends a message, we run it through the
// SAME prompt + model the production webhook would use, and return
// the AI's reply WITHOUT sending it to Facebook. Lets the owner
// sanity-check the bot's behaviour before flipping `enabled` on.
export async function POST(req: NextRequest) {
  const guard = await requirePerm('settings.write');
  if ('response' in guard) return guard.response;

  let body: { message?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });

  const settings = await getAssistantSettings();
  try {
    const result = await callOpenAI({
      systemPrompt: settings.systemPrompt,
      userMessage: message,
      model: settings.model,
      maxTokens: settings.maxTokens,
    });
    return NextResponse.json({ ok: true, reply: result.text, tokens: result.totalTokens });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'AI call failed',
    }, { status: 502 });
  }
}
