export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// Facebook / Instagram webhook endpoint.
//
// GET = verification handshake. Facebook calls this once when you
// register the webhook in App Dashboard → Webhooks. It sends:
//   ?hub.mode=subscribe
//   &hub.verify_token=<token-you-configured>
//   &hub.challenge=<random-string>
// We must echo `hub.challenge` as plain text iff `hub.verify_token`
// matches the value Facebook sees on our side. Mismatch = 403.
//
// POST = real events (messages, page changes, etc.). For now we
// just accept and 200-OK so Facebook doesn't disable the webhook
// because of repeated failures. When we build real handling, parse
// `body.entry[]` and verify the X-Hub-Signature-256 header against
// FB_APP_SECRET.

const VERIFY_TOKEN =
  process.env.FB_VERIFY_TOKEN ||
  process.env.FACEBOOK_VERIFY_TOKEN ||
  'ml_webhook_2026';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === VERIFY_TOKEN && challenge) {
    // Facebook expects the challenge back as plain text, not JSON.
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  // Best-effort logging so the operator can confirm events are
  // arriving once the webhook is live. No DB writes yet — return
  // 200 fast so Facebook doesn't queue retries.
  try {
    const body = await req.text();
    if (process.env.NODE_ENV !== 'production') {
      console.log('[fb-webhook]', body.slice(0, 500));
    }
  } catch {
    /* ignore body parse errors — still ack */
  }
  return NextResponse.json({ received: true });
}
