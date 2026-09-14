export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * The share preview of a post, for link-unfurling crawlers ONLY.
 *
 * ## Why this exists
 *
 * WhatsApp, Facebook, Telegram, X and the rest do not render a page; they fetch it, read
 * the `<meta property="og:…">` tags in its head, and leave. The real post page is a full
 * server render — the post, its author, up to a hundred comments, the viewer's session —
 * and WhatsApp's crawler in particular gives it only a few seconds and a few hundred
 * kilobytes before it gives up. When it gives up it shows the bare domain and no picture,
 * which is exactly what was reported: Facebook (patient) showed the cover, WhatsApp
 * (impatient) showed nothing.
 *
 * `src/middleware.ts` rewrites requests from those crawlers to this route. The URL they see
 * and share stays the canonical post URL — a rewrite, not a redirect — and what they get
 * back is a few hundred bytes of HTML that answers in milliseconds: one indexed query, no
 * session, no comments, no client bundle.
 *
 * A human who somehow lands here (a crawler UA in a browser) is sent on to the real page
 * by the `<meta http-equiv="refresh">`; crawlers ignore that tag.
 *
 * Keep the tags here in step with `generateMetadata` in `../page.tsx`: same title rule,
 * same media choice (image, else the video's cover), same draft/hidden guard.
 */

const SITE = 'https://moslimleader.com';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Cuts to at most `max` characters at a word boundary, with an ellipsis. */
function cutAtWord(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const lastSpace = head.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? head.slice(0, lastSpace) : head).trimEnd() + '…';
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Belt and braces: `params` comes from the route match of the REWRITTEN URL. Should it
  // ever come through empty, the id is still in the path.
  const id = params?.id || req.nextUrl.pathname.split('/').filter(Boolean)[1] || '';

  // An object, not a `let`: TypeScript cannot see an assignment made inside the .catch
  // callback and would narrow a plain variable to `null` for the rest of the function.
  const failure: { msg: string | null } = { msg: null };
  const post = await prisma.tareeqPost
    .findUnique({
      where: { id },
      select: {
        title: true, content: true, authorName: true,
        imageUrl: true, thumbnailUrl: true, videoUrl: true,
        isDraft: true, isHidden: true,
      },
    })
    .catch((e: unknown) => {
      failure.msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return null;
    });

  const pageUrl = `${SITE}/tareeq/${id}`;

  // Same guard as the page: a draft or a moderated post describes nothing to a scraper.
  if (!post || post.isDraft || post.isHidden) {
    // Says WHY, in a header a curl can read. The first live test of this route answered
    // 404 for a post that the page itself served fine, and a bare 404 cannot be debugged.
    const queryError = failure.msg;
    const reason = queryError ? 'error' : !post ? 'not-found' : post.isDraft ? 'draft' : 'hidden';
    if (queryError) console.error('[tareeq preview] query failed for', id, queryError);

    /**
     * Not found, or the query failed: send the crawler to the FULL page instead of an
     * empty document. The full page is known to answer in 0.2s with correct tags, so it is
     * a good preview — and "the preview route could not find a post the page can serve" is
     * a bug in this route, which must never become a worse share than having no route.
     * `_np=1` tells the middleware not to rewrite the redirected request back here.
     * Drafts and hidden posts are the one exception: the page 404s them too.
     */
    if (reason === 'not-found' || reason === 'error') {
      const target = new URL(pageUrl);
      target.searchParams.set('_np', '1');
      return NextResponse.redirect(target.toString(), {
        status: 302,
        headers: { 'Cache-Control': 'no-store', 'X-Tareeq-Preview': `miss:${reason}:id=${id.slice(0, 40)}${queryError ? `:${queryError.slice(0, 120).replace(/[^\x20-\x7e]/g, '?')}` : ''}` },
      });
    }
    return new NextResponse(
      `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طريق — مسلم ليدر</title><meta property="og:title" content="طريق — مسلم ليدر"><meta property="og:url" content="${esc(pageUrl)}"><meta http-equiv="refresh" content="0;url=${esc(pageUrl)}"></head><body></body></html>`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
          'X-Tareeq-Preview': `miss:${reason}:id=${id.slice(0, 40)}${queryError ? `:${queryError.slice(0, 120).replace(/[^\x20-\x7e]/g, '?')}` : ''}`,
        },
      },
    );
  }

  const title = post.title?.trim() || cutAtWord(post.content ?? '', 60) || 'علامة في طريق';
  const description = cutAtWord(post.content ?? '', 160);
  const media = post.imageUrl ?? (post.videoUrl ? post.thumbnailUrl : null);
  // og:image must be absolute or crawlers drop it. Falls back to the generated card route
  // for a text-only post — that one is slow, but it is the same fallback the page uses.
  const image = media ? new URL(media, SITE).toString() : `${SITE}/tareeq/${id}/opengraph-image`;
  const isVideo = !!post.videoUrl;

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(title)} — طريق</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:site_name" content="طريق — مسلم ليدر">
<meta property="og:type" content="${isVideo ? 'video.other' : 'article'}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="ar_AR">
${post.authorName ? `<meta property="article:author" content="${esc(post.authorName)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(pageUrl)}">
</head>
<body><a href="${esc(pageUrl)}">${esc(title)}</a></body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short and shared: a scraper storm on a popular link hits the database once every
      // five minutes, and an edit to the title shows up within the same window.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Robots-Tag': 'noindex',
      'X-Tareeq-Preview': 'hit',
    },
  });
}
