export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shareImageUrl } from '@/lib/share-image';
import { REF_COOKIE, ensureReferralCode } from '@/lib/referral';

/**
 * moslimleader.com/b/<id> — a member's shared badge picture (see /api/badge/share).
 *
 * - Link-preview crawlers get og: tags whose image IS the member's picture, so the post on
 *   WhatsApp/Facebook shows it.
 * - People are sent to /badge carrying the member's invite code — the same cookie /r/<code>
 *   sets — so whoever joins from the picture is credited to the member who posted it.
 */
const UNFURL_BOT = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterestbot|Snapchat|SkypeUriPreview|iMessageLinkPreview|redditbot|vkShare/i;
const SITE = 'https://moslimleader.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = /^[a-z0-9]{6,12}$/.test(id)
    ? await prisma.badgeShare.findUnique({ where: { id } }).catch(() => null)
    : null;

  if (UNFURL_BOT.test(req.headers.get('user-agent') || '')) {
    const self = `${SITE}/b/${esc(id)}`;
    const title = 'انضممت لمجتمع مسلم ليدر — اعمل البادج بتاعك';
    const desc = 'مجتمع النبلاء: مجتمع يربّي أبناءنا على القيم والنبل والأخلاق. ضع بادج مسلم ليدر على صورتك.';
    const img = share ? shareImageUrl(share.imageUrl) : `${SITE}/badge-pictures/og.jpg`;
    const size = share ? 1080 : null;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="مسلم ليدر">
<meta property="og:url" content="${self}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="${size ?? 1200}">
<meta property="og:image:height" content="${size ?? 630}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:image" content="${esc(img)}">
</head><body><a href="${self}">${esc(title)}</a></body></html>`;
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.NODE_ENV === 'production' ? SITE : req.nextUrl.origin);
  const res = NextResponse.redirect(new URL('/badge', base), 302);
  const code = share ? await ensureReferralCode(share.userId).catch(() => null) : null;
  if (code) {
    res.cookies.set(REF_COOKIE, code, {
      maxAge: 60 * 24 * 60 * 60, path: '/', sameSite: 'lax', httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return res;
}
