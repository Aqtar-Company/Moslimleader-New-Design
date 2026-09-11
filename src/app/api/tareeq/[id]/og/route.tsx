export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { buildOgTree, loadOgFont, OG_WIDTH, OG_HEIGHT } from '@/lib/tareeq-og';

/**
 * The link-preview image for a Tareeq post (1200×630 PNG).
 *
 * It used to return SVG, on the theory that "all major scrapers support it". Facebook
 * does rasterise it — without our webfont — so `<text font-family="Cairo">` came out as a
 * grid of hex boxes and every shared post looked broken. PNG, with Cairo embedded in the
 * render, is the only version that survives a scraper.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: {
      title: true, content: true, authorName: true, category: true,
      imageUrl: true, thumbnailUrl: true, isHidden: true,
    },
  });

  // A hidden post must not leak its text through the preview card.
  const visible = post && !post.isHidden ? post : null;

  // Real media beats a generated card. `thumbnailUrl` covers video posts, which previously
  // fell through to a text card even when a poster frame existed.
  const media = visible?.imageUrl || visible?.thumbnailUrl;
  if (media) {
    // Stored values are often site-relative; a relative Location is legal but scrapers
    // handle it inconsistently, so resolve it against this request.
    return NextResponse.redirect(new URL(media, req.nextUrl.origin), 307);
  }

  const title = visible?.title?.trim() || visible?.content?.trim() || 'علامة في طريق';

  // satori throws without a font, and it reads from disk — `public/fonts/og/` is in git,
  // but a deploy that never ran `git reset --hard` would 500 every preview instead of
  // showing a plain logo.
  const font = loadOgFont();
  if (!font) {
    return NextResponse.redirect(new URL('/ml-logo-new.png', req.nextUrl.origin), 307);
  }

  return new ImageResponse(
    buildOgTree({ title, author: visible?.authorName, category: visible?.category }),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [{ name: 'Cairo', data: font, weight: 700, style: 'normal' }],
      headers: {
        // Long cache: the scrapers hit this once and hold the result for far longer anyway.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    },
  );
}
