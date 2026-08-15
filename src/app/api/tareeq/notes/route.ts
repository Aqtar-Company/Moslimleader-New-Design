export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/tareeq/notes?q=search&sort=newest|oldest&cursor=xxx&limit=20
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q      = searchParams.get('q')?.trim() || undefined;
  const sort   = searchParams.get('sort') ?? 'newest';
  const cursor = searchParams.get('cursor') || undefined;
  const limit  = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  const orderBy = sort === 'oldest'
    ? { updatedAt: 'asc' as const }
    : { updatedAt: 'desc' as const };

  const where = {
    userId: user.userId,
    ...(q ? {
      OR: [
        { title:   { contains: q } },
        { content: { contains: q } },
      ],
    } : {}),
  };

  const notes = await prisma.tareeqNote.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, title: true, content: true, imageUrl: true, createdAt: true, updatedAt: true },
  });

  const hasMore = notes.length > limit;
  const items   = hasMore ? notes.slice(0, limit) : notes;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ notes: items, nextCursor });
}

// POST /api/tareeq/notes — create note
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq-note-create:${ip}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body    = await req.json().catch(() => ({}));
  const title   = String(body.title   ?? '').trim().slice(0, 200) || null;
  const content = String(body.content ?? '').trim().slice(0, 50000);
  const imageUrl = String(body.imageUrl ?? '').trim() || null;

  if (!content && !imageUrl) return NextResponse.json({ error: 'الملاحظة فارغة' }, { status: 400 });

  const note = await prisma.tareeqNote.create({
    data: { userId: user.userId, title, content, imageUrl },
    select: { id: true, title: true, content: true, imageUrl: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, note });
}
