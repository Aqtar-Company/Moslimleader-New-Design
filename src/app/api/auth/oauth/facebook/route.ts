export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.FACEBOOK_APP_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
  const redirectUri = `${baseUrl}/api/auth/oauth/facebook/callback`;

  // CSRF protection: generate a random state, store in httpOnly cookie, verify in callback
  const state = randomUUID();

  // See the Google OAuth route for why this needs a cookie rather than a query param —
  // same shared mechanism, so both providers land the user back where they started.
  const { searchParams } = new URL(req.url);
  const rawRedirect = searchParams.get('redirect') || '/tareeq';
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/tareeq';

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'public_profile,email',
    state,
  });

  const response = NextResponse.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
  response.cookies.set('oauth_state_fb', state, {
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
