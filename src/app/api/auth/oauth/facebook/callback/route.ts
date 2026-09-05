export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, makeAuthCookie } from '@/lib/jwt';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const receivedState = searchParams.get('state');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';

  const clearState = (res: NextResponse) => {
    res.cookies.set('oauth_state_fb', '', { httpOnly: true, maxAge: 0, path: '/' });
    return res;
  };

  if (error || !code) {
    return clearState(NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`));
  }

  // Verify CSRF state cookie (separate from Google's oauth_state)
  const cookieState = req.cookies.get('oauth_state_fb')?.value;
  if (!cookieState || !receivedState || cookieState !== receivedState) {
    return clearState(NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`));
  }

  try {
    const clientId = process.env.FACEBOOK_APP_ID!;
    const clientSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${baseUrl}/api/auth/oauth/facebook/callback`;

    // Exchange code for access token
    const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return clearState(NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`));
    }

    // Get user info from Facebook
    const userRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`
    );
    const fbUser = await userRes.json();

    if (!fbUser.id) {
      return clearState(NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`));
    }

    // 1. Look up by OAuthAccount first — handles users who revoked email permission
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'facebook', providerAccountId: String(fbUser.id) } },
      select: { userId: true },
    });

    let user;
    if (existingOAuth) {
      // Known FB user — load their account directly
      user = await prisma.user.findUnique({ where: { id: existingOAuth.userId } });
    }

    if (!user) {
      // 2. Try by email (first-time login with email permission)
      const emailKey = fbUser.email
        ? fbUser.email.toLowerCase()
        : `fb_${fbUser.id}@fb.placeholder`;

      user = await prisma.user.findUnique({ where: { email: emailKey } });

      if (!user) {
        const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
        const role = (adminEmail && emailKey === adminEmail) ? 'admin' : 'customer';
        user = await prisma.user.create({
          data: { name: fbUser.name || `fb_${fbUser.id}`, email: emailKey, passwordHash: '', emailVerified: true, role, savedAddresses: [] },
        });
      }

      // Link this FB account to the user (first time)
      await prisma.oAuthAccount.upsert({
        where: { provider_providerAccountId: { provider: 'facebook', providerAccountId: String(fbUser.id) } },
        update: {},
        create: { provider: 'facebook', providerAccountId: String(fbUser.id), userId: user.id },
      });
    }

    if (!user) {
      return clearState(NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`));
    }

    if (!user.emailVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    const token = await signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
    const response = NextResponse.redirect(`${baseUrl}/tareeq`);
    response.cookies.set(makeAuthCookie(token));
    return clearState(response);
  } catch (err) {
    console.error('[facebook oauth callback]', err);
    return clearState(NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`));
  }
}
