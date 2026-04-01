import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/jwt';

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

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          name: googleUser.name || googleUser.email.split('@')[0],
          email: googleUser.email,
          passwordHash: '', // No password for OAuth users
          role: 'customer',
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

    // Create JWT token
    const token = await signToken({ userId: user.id, email: user.email, role: user.role });

    // Set cookie and redirect
    const response = NextResponse.redirect(`${baseUrl}/`);
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Google OAuth error:', err);
    return NextResponse.redirect(`${baseUrl}/auth?error=google_failed`);
  }
}
