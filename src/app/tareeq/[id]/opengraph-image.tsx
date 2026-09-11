import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { buildOgTree, loadOgFont, OG_WIDTH, OG_HEIGHT } from '@/lib/tareeq-og';

/**
 * The share card for one post, as a file-convention route.
 *
 * The card used to be served from `/api/tareeq/[id]/og`, and `robots.txt` disallows
 * `/api/` wholesale. `facebookexternalhit` honours robots.txt, so Facebook was told it
 * may not fetch the preview image of every single post — the one thing the share is for.
 * Here the path is `/tareeq/<id>/opengraph-image`, which is crawlable, and Next emits
 * `og:image` plus its width/height/type itself.
 *
 * The old route stays in place: Facebook caches the URL it first scraped, so links already
 * shared still point at it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'طريق — مسلم ليدر';
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = 'image/png';

export default async function PostOgImage({ params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost
    .findUnique({
      where: { id: params.id },
      select: { title: true, content: true, authorName: true, category: true, isHidden: true },
    })
    .catch(() => null);

  // A hidden post must not leak its text through the preview card.
  const visible = post && !post.isHidden ? post : null;
  const title = visible?.title?.trim() || visible?.content?.trim() || 'علامة في طريق';
  const font = loadOgFont();

  return new ImageResponse(
    buildOgTree({ title, author: visible?.authorName, category: visible?.category }),
    {
      ...size,
      fonts: font ? [{ name: 'Cairo', data: font, weight: 700, style: 'normal' }] : undefined,
    },
  );
}
