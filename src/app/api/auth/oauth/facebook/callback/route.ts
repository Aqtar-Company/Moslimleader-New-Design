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

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`);
  }

  // Verify CSRF state cookie
  const cookieState = req.cookies.get('oauth_state')?.value;
  if (!cookieState || !receivedState || cookieState !== receivedState) {
    return NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`);
  }

  try {
    const clientId = process.env.FACEBOOK_APP_ID!;
    const clientSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${baseUrl}/api/auth/oauth/facebook/callback`;

    // Exchange code for access token
    const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`);
    }

    // Get user info from Facebook
    const userRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`
    );
    const fbUser = await userRes.json();

    if (!fbUser.id) {
      return NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`);
    }

    // Facebook may not return email if user removed it — generate a placeholder in that case
    const emailKey = fbUser.email
      ? fbUser.email.toLowerCase()
      : `fb_${fbUser.id}@fb.placeholder`;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: emailKey } });

    if (!user) {
      // Grant admin role if email matches ADMIN_EMAIL env var
      const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
      const role = (adminEmail && emailKey === adminEmail) ? 'admin' : 'customer';

      user = await prisma.user.create({
        data: {
          name: fbUser.name || emailKey.split('@')[0],
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
          provider: 'facebook',
          providerAccountId: String(fbUser.id),
        },
      },
      update: {},
      create: {
        provider: 'facebook',
        providerAccountId: String(fbUser.id),
        userId: user.id,
      },
    });

    // Create JWT token and set cookie using shared makeAuthCookie (consistent cookie name)
    const token = await signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
    const response = NextResponse.redirect(`${baseUrl}/tareeq`);
    response.cookies.set(makeAuthCookie(token));
    // Clear the CSRF state cookie
    response.cookies.set('oauth_state', '', { httpOnly: true, maxAge: 0, path: '/' });

    return response;
  } catch (err) {
    console.error('[facebook oauth callback]', err);
    const errResponse = NextResponse.redirect(`${baseUrl}/tareeq/login?error=fb_failed`);
    errResponse.cookies.set('oauth_state', '', { httpOnly: true, maxAge: 0, path: '/' });
    return errResponse;
  }
}
