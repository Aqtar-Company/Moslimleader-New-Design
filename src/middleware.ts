import { NextRequest, NextResponse } from 'next/server';

/** The visitor's language choice, written by LanguageContext. */
const LANG_COOKIE = 'ml_lang';

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
/** A media item or a reel: /media/<id>, /media/reels/<id>. */
const MEDIA_PATH = /^\/media\/(?:reels\/)?(\d{1,9})$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isRead = req.method === 'GET' || req.method === 'HEAD';

  // ── Language in the URL ──
  // /en/<path> is the English edition of /<path>: rewritten to the same page, with headers
  // telling the root layout to render it in English and to point canonical/hreflang at the
  // /en address. Google has no cookie and no localStorage, so a URL is the only way it can
  // ever see — and list — the English site.
  if (isRead && (pathname === '/en' || pathname.startsWith('/en/'))) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    const h = new Headers(req.headers);
    h.set('x-ml-lang', 'en');
    h.set('x-ml-en-url', '1');
    h.set('x-ml-path', url.pathname);
    return NextResponse.rewrite(url, { request: { headers: h } });
  }

  // Every other page learns its own path (for canonical/hreflang) and the visitor's chosen
  // language (cookie), so the server renders the right language the first time.
  const pageHeaders = () => {
    const h = new Headers(req.headers);
    h.set('x-ml-path', pathname);
    const c = req.cookies.get(LANG_COOKIE)?.value;
    if (c === 'en' || c === 'ar') h.set('x-ml-lang', c);
    return h;
  };

  if (pathname === '/') {
    return NextResponse.next({ request: { headers: pageHeaders() } });
  }

  // Crawlers asking for a post get the lightweight preview document instead — a REWRITE,
  // so the URL they display and share stays the canonical post URL. See
  // src/app/tareeq/[id]/preview/route.ts.
  // `_np=1` is set by the preview route when it sends a crawler on to the full page; without
  // this exception that redirect would be rewritten straight back to the preview — a loop.
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.nextUrl.searchParams.has('_np')) {
    const m = POST_PATH.exec(pathname);
    if (m && UNFURL_BOT.test(req.headers.get('user-agent') ?? '')) {
      const url = req.nextUrl.clone();
      url.pathname = `/tareeq/${m[1]}/preview`;
      return NextResponse.rewrite(url);
    }
    // The same for the media library: src/app/media/preview/[id]/route.ts.
    const mm = MEDIA_PATH.exec(pathname);
    if (mm && UNFURL_BOT.test(req.headers.get('user-agent') ?? '')) {
      const url = req.nextUrl.clone();
      url.pathname = `/media/preview/${mm[1]}`;
      return NextResponse.rewrite(url);
    }
  }

  // Pages: pass the path + language on. (A page reached by any other method falls through
  // to the same origin check as before.)
  if (isRead && !pathname.startsWith('/api/')) {
    return NextResponse.next({ request: { headers: pageHeaders() } });
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
  // NOT '/tareeq/:id'. Next 14 compiled that single, unmodified param to a regexp matching
  // bare `/tareeq` only (see .next/server/middleware-manifest.json after a build) — the
  // middleware never ran for a permalink and the crawler rewrite silently did nothing on
  // the live site. `:path*` compiles correctly; the cuid test in POST_PATH is what limits
  // the rewrite to permalinks. Ordinary GETs on the other /tareeq pages cost one regexp.
  // Every page and /api — but never Next's own assets or files (anything with an extension),
  // which would only pay for a function call they do not need.
  matcher: ['/((?!_next/|.*\\.[a-zA-Z0-9]{2,5}$).*)'],
};
