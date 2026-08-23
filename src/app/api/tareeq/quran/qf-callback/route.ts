export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth2 callback for Quran Foundation.
 * QF redirects here after user auth (authorization_code flow).
 * For our server-side use we primarily use client_credentials,
 * so this route just confirms the registration is wired up.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/tareeq?qf=error', req.nextUrl.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/tareeq', req.nextUrl.origin));
  }

  // Exchange code for token (optional — we use client_credentials for API calls)
  const clientId = process.env.QF_CLIENT_ID ?? '';
  const clientSecret = process.env.QF_CLIENT_SECRET ?? '';
  if (clientId && clientSecret) {
    try {
      await fetch('https://auth.quran.foundation/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${req.nextUrl.origin}/api/tareeq/quran/qf-callback`,
        }),
      });
    } catch { /* non-critical */ }
  }

  return NextResponse.redirect(new URL('/tareeq', req.nextUrl.origin));
}
