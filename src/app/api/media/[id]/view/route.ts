export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { claimShared } from '@/lib/tareeq-store';

/**
 * Count a view of a media item: once per address per six hours, so a reload, a replay or
 * an autoplay loop does not inflate the number shown under every thumbnail.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const fresh = await claimShared(`media-view:${id}:${ip}`, 6 * 3600).catch(() => false);
  if (fresh) {
    await prisma.freeMedia.updateMany({ where: { id, isPublished: true }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
