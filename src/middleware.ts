import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://moslimleader.com',
  'https://www.moslimleader.com',
  'http://localhost:3000',
];

// NOTE ON SCOPE: this middleware does CSRF origin checking only — it deliberately does
// NOT gate /tareeq or /tareeq-admin. Two dead helpers (isMobile, getJwtPayload) used to
// sit here suggesting otherwise; they were never called and have been removed so nobody
// mistakes this for an auth boundary.
//   - /tareeq is intentionally browsable by guests (TareeqLoginGate prompts on the
//     actions that actually require an account), so an auth redirect here would break it.
//   - /tareeq-admin is enforced per-route on the server (every /api/tareeq-admin/*
//     handler checks the role) plus client gating in AdminShell. That server-side check
//     is the real boundary.

/**
 * Link-unfurling crawlers. These fetch a page only to read its og: tags, and WhatsApp's in
 * particular gives up after a few seconds and a few hundred KB — on the real post page
 * (full render, comments, session) it gave up every time and showed the bare domain.
 * Search engines are deliberately NOT here: they should index the real page.
 */
const UNFURL_BOT = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterestbot|Snapchat|SkypeUriPreview|iMessageLinkPreview|redditbot|vkShare|W3C_Validator/i;
/** A post permalink: /tareeq/<cuid>. Excludes /tareeq/inbox, /tareeq/drafts and friends. */
const POST_PATH = /^\/tareeq\/(c[a-z0-9]{20,32})$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/') {
    return NextResponse.next();
  }

  // Crawlers asking for a post get the lightweight preview document instead — a REWRITE,
  // so the URL they display and share stays the canonical post URL. See
  // src/app/tareeq/[id]/preview/route.ts.
  if (req.method === 'GET' || req.method === 'HEAD') {
    const m = POST_PATH.exec(pathname);
    if (m && UNFURL_BOT.test(req.headers.get('user-agent') ?? '')) {
      const url = req.nextUrl.clone();
      url.pathname = `/tareeq/${m[1]}/preview`;
      return NextResponse.rewrite(url);
    }
  }

  // CSRF guard for all API mutations
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return NextResponse.next();
  }

  if (pathname.includes('/webhook') || pathname.includes('/track/')) {
    return NextResponse.next();
  }

  const origin = req.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  // '/tareeq/:id' is one segment only: post permalinks, for the crawler rewrite above. GET
  // requests from ordinary browsers fall straight through to the page.
  matcher: ['/', '/api/:path*', '/tareeq/:id'],
};
