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

  // This route is shared by the shop's /login and Tareeq's /tareeq/login — the redirect
  // cookie set in the start route tells us which one to send the user back to on error,
  // and where to land on success (see below), instead of always assuming the shop.
  const rawRedirect = req.cookies.get('oauth_redirect')?.value || '/';
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const loginPage = safeRedirect.startsWith('/tareeq') ? '/tareeq/login' : '/login';

  const clearRedirectCookie = (res: NextResponse) => {
    res.cookies.set('oauth_redirect', '', { httpOnly: true, maxAge: 0, path: '/' });
    return res;
  };

  if (error || !code) {
    return clearRedirectCookie(NextResponse.redirect(`${baseUrl}${loginPage}?error=google_denied`));
  }

  // Verify CSRF state cookie
  const cookieState = req.cookies.get('oauth_state')?.value;
  if (!cookieState || !receivedState || cookieState !== receivedState) {
    return clearRedirectCookie(NextResponse.redirect(`${baseUrl}${loginPage}?error=google_csrf`));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${baseUrl}/api/auth/oauth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return clearRedirectCookie(NextResponse.redirect(`${baseUrl}${loginPage}?error=google_token`));
    }

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.email) {
      return clearRedirectCookie(NextResponse.redirect(`${baseUrl}${loginPage}?error=google_email`));
    }

    const emailKey = googleUser.email.toLowerCase();

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: emailKey } });

    if (!user) {
      // Grant admin role if email matches ADMIN_EMAIL env var
      const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
      const role = (adminEmail && emailKey === adminEmail) ? 'admin' : 'customer';

      user = await prisma.user.create({
        data: {
          name: googleUser.name || emailKey.split('@')[0],
          email: emailKey,
          passwordHash: '',
          emailVerified: true,
          role,
          savedAddresses: [],
        },
      });
    }

    if (!user.emailVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    // Link OAuth account
    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleUser.id,
        },
      },
      update: {},
      create: {
        provider: 'google',
        providerAccountId: googleUser.id,
        userId: user.id,
      },
    });

    // Create JWT token and set cookie using shared makeAuthCookie (consistent cookie name)
    const token = await signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
    const response = NextResponse.redirect(`${baseUrl}${safeRedirect}`);
    response.cookies.set(makeAuthCookie(token));
    // Clear the CSRF state + redirect cookies
    response.cookies.set('oauth_state', '', { httpOnly: true, maxAge: 0, path: '/' });
    response.cookies.set('oauth_redirect', '', { httpOnly: true, maxAge: 0, path: '/' });

    return response;
  } catch (err) {
    console.error('[google oauth callback]', err);
    const errResponse = NextResponse.redirect(`${baseUrl}${loginPage}?error=google_failed`);
    errResponse.cookies.set('oauth_state', '', { httpOnly: true, maxAge: 0, path: '/' });
    errResponse.cookies.set('oauth_redirect', '', { httpOnly: true, maxAge: 0, path: '/' });
    return errResponse;
  }
}
