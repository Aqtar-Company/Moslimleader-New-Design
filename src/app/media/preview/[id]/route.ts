export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SITE_URL, ORG_OG_IMAGE } from '@/lib/seo';
import { absoluteMediaUrl } from '@/lib/free-media-query';
import { KIND_LABEL, TYPE_TO_KIND } from '@/lib/free-media-shared';

/**
 * The link preview for a shared media item — what WhatsApp, Facebook and Telegram read.
 *
 * `src/middleware.ts` rewrites crawler requests for `/media/<id>` and `/media/reels/<id>`
 * here, the same arrangement طريق's posts use (see CLAUDE.md, «Link previews»): a full
 * media page is heavy, and WhatsApp's crawler gives up on heavy pages and shows only the
 * domain — no picture, no title. This answers in a few hundred bytes with the item's own
 * thumbnail, title and description.
 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cut(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const head = t.slice(0, n);
  const sp = head.lastIndexOf(' ');
  return `${(sp > n * 0.6 ? head.slice(0, sp) : head).trim()}…`;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const item = Number.isInteger(id)
    ? await prisma.freeMedia.findFirst({
        where: { id, isPublished: true },
        select: { id: true, title: true, type: true, description: true, coverUrl: true, url: true, category: { select: { name: true } } },
      }).catch(() => null)
    : null;

  const kind = item ? TYPE_TO_KIND[item.type] : null;
  if (!item || !kind) {
    // Not ours to describe — send the crawler to the real page, marked so the middleware
    // does not rewrite it straight back here.
    const back = new URL(req.nextUrl.pathname.replace('/media/preview/', '/media/'), SITE_URL);
    back.searchParams.set('_np', '1');
    return NextResponse.redirect(back, 302);
  }

  const pageUrl = `${SITE_URL.replace(/\/+$/, '')}${kind === 'reel' ? `/media/reels/${item.id}` : `/media/${item.id}`}`;
  const title = item.title;
  const description = cut(item.description || `${KIND_LABEL[kind].one} مجاني من مسلم ليدر${item.category ? ` — ${item.category.name}` : ''}`, 160);
  // The cover is a JPEG by construction (compressCover / drawingThumb), which every scraper
  // accepts. Without one, the site's logo rather than nothing.
  const image = absoluteMediaUrl(item.coverUrl, SITE_URL) ?? ORG_OG_IMAGE;
  const ogType = kind === 'video' || kind === 'reel' ? 'video.other' : kind === 'audio' ? 'music.song' : 'website';

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(title)} — وسائط مسلم ليدر</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:site_name" content="مسلم ليدر">
<meta property="og:type" content="${ogType}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="ar_AR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
</head>
<body><a href="${esc(pageUrl)}">${esc(title)}</a></body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Robots-Tag': 'noindex',
      'X-Media-Preview': 'hit',
    },
  });
}
