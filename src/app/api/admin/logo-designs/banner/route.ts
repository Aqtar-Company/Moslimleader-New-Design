export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { R2_PUBLIC_URL } from '@/lib/r2';
import { LOGO_BANNER_KEY, LOGO_R2_PREFIX, loadLogoBanner, removeDesignFiles } from '@/lib/logo-designs';

/** The /logo page banner: GET reads it, PUT { imageUrl, title, subtitle } saves it. */
export async function GET() {
  const guard = await requirePerm(['free-media.read', 'free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  return NextResponse.json({ banner: await loadLogoBanner() });
}

export async function PUT(req: NextRequest) {
  const guard = await requirePerm(['free-media.write', 'books.write']);
  if ('response' in guard) return guard.response;
  const b = await req.json().catch(() => ({}));
  const imageUrl = typeof b.imageUrl === 'string' && b.imageUrl ? b.imageUrl : null;
  if (imageUrl && !(R2_PUBLIC_URL && imageUrl.startsWith(`${R2_PUBLIC_URL}/${LOGO_R2_PREFIX}`))) {
    return NextResponse.json({ error: 'صورة البانر غير صالحة' }, { status: 400 });
  }
  const value = {
    imageUrl,
    title: String(b.title ?? '').trim().slice(0, 120),
    subtitle: String(b.subtitle ?? '').trim().slice(0, 300),
  };
  const previous = await loadLogoBanner();
  await prisma.setting.upsert({ where: { key: LOGO_BANNER_KEY }, create: { key: LOGO_BANNER_KEY, value }, update: { value } });
  if (previous.imageUrl && previous.imageUrl !== imageUrl) void removeDesignFiles([previous.imageUrl]);
  return NextResponse.json({ banner: await loadLogoBanner() });
}
