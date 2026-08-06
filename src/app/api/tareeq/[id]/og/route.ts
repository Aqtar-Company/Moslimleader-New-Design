export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CATEGORY_AR: Record<string, string> = {
  experience: 'تجربة', story: 'قصة', idea: 'فكرة',
  question: 'سؤال', project: 'مشروع', reflection: 'تأمل',
};

// Generates a simple SVG-based OG image (1200×630) for text posts.
// Returns SVG as image/svg+xml — supported by all major link-preview scrapers.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const post = await prisma.tareeqPost.findUnique({
    where: { id: params.id },
    select: { title: true, content: true, authorName: true, category: true, imageUrl: true },
  });

  // If the post has an image, redirect to it directly
  if (post?.imageUrl) {
    return NextResponse.redirect(post.imageUrl, 301);
  }

  const title = post?.title ?? post?.content?.slice(0, 80) ?? 'علامة في طريق';
  const author = post?.authorName ?? '';
  const cat = CATEGORY_AR[post?.category ?? ''] ?? '';

  // Wrap long title into two lines (≤40 chars each)
  const words = title.split(' ');
  let line1 = '', line2 = '';
  for (const w of words) {
    if ((line1 + ' ' + w).trim().length <= 40) line1 = (line1 + ' ' + w).trim();
    else line2 = (line2 + ' ' + w).trim();
  }
  const titleLines = line2 ? [line1, line2] : [line1];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f9f7f5"/>
      <stop offset="100%" style="stop-color:#f2efea"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ff7857"/>
      <stop offset="100%" style="stop-color:#ff3d1a"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Top accent bar -->
  <rect width="1200" height="8" fill="url(#accent)"/>

  <!-- Star watermark -->
  <text x="900" y="420" font-size="320" opacity="0.04" fill="#ff5c38" font-family="serif" text-anchor="middle">★</text>

  <!-- Category badge -->
  ${cat ? `<rect x="80" y="80" width="${cat.length * 28 + 40}" height="48" rx="24" fill="#ff5c38" opacity="0.12"/>
  <text x="${(cat.length * 28 + 40) / 2 + 80}" y="113" font-size="26" fill="#ff5c38" font-family="Cairo,Arial" text-anchor="middle" font-weight="700">${cat}</text>` : ''}

  <!-- Title -->
  ${titleLines.map((line, i) => `<text x="600" y="${titleLines.length === 1 ? 330 : 295 + i * 90}"
    font-size="64" font-family="Cairo,Arial,sans-serif" font-weight="900"
    fill="#1a1a2a" text-anchor="middle" direction="rtl">${line}</text>`).join('\n  ')}

  <!-- Author -->
  ${author ? `<text x="600" y="490" font-size="32" font-family="Cairo,Arial,sans-serif" fill="#9896a8" text-anchor="middle">${author}</text>` : ''}

  <!-- Bottom brand -->
  <text x="600" y="580" font-size="28" font-family="Cairo,Arial,sans-serif" fill="#ff5c38" text-anchor="middle" font-weight="700">★ طريق — مسلم ليدر</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
