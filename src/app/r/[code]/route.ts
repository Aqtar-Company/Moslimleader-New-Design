export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { REF_COOKIE, normalizeCode } from '@/lib/referral';

/**
 * moslimleader.com/r/<code> — a member's invite link. Remembers the code for 60 days and
 * lands on /badge (or `?to=` from a short allowlist). The code is checked against the
 * database only at sign-up, so this answers instantly and never reveals whether a code exists.
 *
 * Link-preview crawlers get a small page of og: tags instead of the redirect. Following the
 * redirect, Facebook would read /badge's og:url and make THAT the link in the post — every
 * click would then reach /badge without the code, and nobody would ever be credited.
 */
const DESTINATIONS = new Set(['/', '/badge', '/library', '/membership', '/shop']);
const UNFURL_BOT = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterestbot|Snapchat|SkypeUriPreview|iMessageLinkPreview|redditbot|vkShare/i;
const SITE = 'https://moslimleader.com';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  const to = req.nextUrl.searchParams.get('to') || '/badge';
  const path = DESTINATIONS.has(to) ? to : '/badge';

  if (UNFURL_BOT.test(req.headers.get('user-agent') || '')) {
    const self = `${SITE}/r/${code ?? ''}${path !== '/badge' ? `?to=${encodeURIComponent(path)}` : ''}`;
    const title = 'بادج مسلم ليدر — ضعه على صورتك';
    const desc = 'انضم لمجتمع مسلم ليدر، مجتمع النبلاء: ارفع صورتك، ضع عليها البادج، وحمّلها لتستخدمها في أي مكان.';
    const img = `${SITE}/badge-pictures/og.jpg`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="مسلم ليدر">
<meta property="og:url" content="${esc(self)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
</head><body><a href="${esc(self)}">${esc(title)}</a></body></html>`;
    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  }

  // Behind nginx, req.nextUrl.origin is the internal address — build on the public one.
  const base = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.NODE_ENV === 'production' ? SITE : req.nextUrl.origin);
  const res = NextResponse.redirect(new URL(path, base), 302);
  if (code) {
    res.cookies.set(REF_COOKIE, code, {
      maxAge: 60 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return res;
}
