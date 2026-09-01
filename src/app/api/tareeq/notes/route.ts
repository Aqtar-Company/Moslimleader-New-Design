export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';
import { Prisma } from '@prisma/client';

// Strip MySQL BOOLEAN MODE operators to avoid syntax errors in MATCH...AGAINST
function sanitizeFulltext(q: string): string {
  return q.replace(/[+\-><()~*"@]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface NoteRow {
  id: string;
  title: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// GET /api/tareeq/notes?q=search&sort=newest|oldest&cursor=xxx&limit=20
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q      = searchParams.get('q')?.trim() || undefined;
  const sort   = searchParams.get('sort') ?? 'newest';
  const cursor = searchParams.get('cursor') || undefined;
  const limit  = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  // MySQL InnoDB default ft_min_word_len=4 — Arabic words < 4 chars aren't indexed.
  // Use FULLTEXT (MATCH...AGAINST composite index) only for q >= 4 chars.
  // Shorter queries fall back to LIKE (full scan, acceptable for small note counts).
  const useFulltext = !!q && sanitizeFulltext(q).length >= 4;

  let notes: NoteRow[];

  if (useFulltext) {
    const safeQ = sanitizeFulltext(q!);
    const orderSql = sort === 'oldest' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const cursorClause = cursor
      ? Prisma.sql`AND (n.updatedAt ${sort === 'oldest' ? Prisma.sql`>` : Prisma.sql`<`}
          (SELECT updatedAt FROM TareeqNote WHERE id = ${cursor})
          OR (n.updatedAt = (SELECT updatedAt FROM TareeqNote WHERE id = ${cursor}) AND n.id > ${cursor}))`
      : Prisma.sql``;

    // @@fulltext([title, content]) — composite index; MATCH must list both columns
    notes = await prisma.$queryRaw<NoteRow[]>`
      SELECT n.id, n.title, n.content, n.imageUrl, n.createdAt, n.updatedAt
      FROM TareeqNote n
      WHERE n.userId = ${user.userId}
        AND MATCH(n.title, n.content) AGAINST(${safeQ} IN BOOLEAN MODE)
        ${cursorClause}
      ORDER BY n.updatedAt ${orderSql}
      LIMIT ${limit + 1}
    `;
  } else {
    const orderBy = sort === 'oldest'
      ? { updatedAt: 'asc' as const }
      : { updatedAt: 'desc' as const };

    const where = {
      userId: user.userId,
      ...(q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}),
    };

    notes = await prisma.tareeqNote.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, title: true, content: true, imageUrl: true, createdAt: true, updatedAt: true },
    });
  }

  const hasMore    = notes.length > limit;
  const items      = hasMore ? notes.slice(0, limit) : notes;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ notes: items, nextCursor });
}

// POST /api/tareeq/notes — create note
export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const rl = tareeqRateLimit('note-create', user.userId, 30, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

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
