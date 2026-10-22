export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { isAllowedMediaRef, removeStoredMedia } from '@/lib/free-media';
import { MEDIA_HERO_KEY, loadMediaHero } from '@/lib/free-media-query';

/** The /media page's hero image. GET reads it; PUT `{ url }` sets it, `{ url: null }` removes it. */
export async function GET() {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  return NextResponse.json({ url: await loadMediaHero() });
}

export async function PUT(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === 'string' && body.url ? body.url : null;
  if (url && !isAllowedMediaRef(url)) return NextResponse.json({ error: 'رابط الصورة غير صالح' }, { status: 400 });

  const previous = await loadMediaHero();
  await prisma.setting.upsert({
    where: { key: MEDIA_HERO_KEY },
    create: { key: MEDIA_HERO_KEY, value: { url } },
    update: { value: { url } },
  });
  // The old picture is no longer shown anywhere; drop it from storage after answering.
  if (previous && previous !== url) void removeStoredMedia(previous).catch(() => {});
  return NextResponse.json({ url });
}
