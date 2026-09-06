export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com'}/api/auth/oauth/google/callback`;

  // CSRF protection: generate a random state, store in httpOnly cookie, verify in callback
  const state = randomUUID();

  // Where to land after a successful login — Google/Facebook don't round-trip arbitrary
  // query params through their consent screens, so this can't just be appended to
  // redirect_uri (it also has to exactly match what's registered with each provider).
  // A short-lived cookie carries it across the round trip instead. This route is shared
  // by both the shop's /login and Tareeq's /tareeq/login, so without this the button
  // always landed on the shop homepage regardless of which page (or deep link) started it.
  const { searchParams } = new URL(req.url);
  const rawRedirect = searchParams.get('redirect') || '/';
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });
  response.cookies.set('oauth_redirect', safeRedirect, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
