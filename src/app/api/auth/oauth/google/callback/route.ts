import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, makeAuthCookie } from '@/lib/jwt';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/auth?error=google_denied`);
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
      return NextResponse.redirect(`${baseUrl}/auth?error=google_token`);
    }

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.email) {
      return NextResponse.redirect(`${baseUrl}/auth?error=google_email`);
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
          passwordHash: '', // No password for OAuth users
          role,
          savedAddresses: [],
        },
      });
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
    const token = await signToken({ userId: user.id, email: user.email, role: user.role });
    const response = NextResponse.redirect(`${baseUrl}/`);
    response.cookies.set(makeAuthCookie(token));

    return response;
  } catch (err) {
    console.error('[google oauth callback]', err);
    return NextResponse.redirect(`${baseUrl}/auth?error=google_failed`);
  }
}
