export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';
import { CATEGORY_KEY } from '@/lib/tareeq-constants';

// GET /api/tareeq?cursor=xxx&category=xxx&limit=12
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get('cursor') || undefined;
  const category = searchParams.get('category') || undefined;
  const search = searchParams.get('search')?.trim() || undefined;
  const userId = searchParams.get('userId') || undefined;
  const sort = searchParams.get('sort') ?? 'newest';
  const limit = Math.min(Number(searchParams.get('limit') ?? 12), 30);
  const orderBy = sort === 'liked'
    ? { likeCount: 'desc' as const }
    : { createdAt: 'desc' as const };

  const where = {
    ...(category ? { category } : {}),
    ...(userId ? { userId } : {}),
    ...(search ? {
      OR: [
        { title: { contains: search } },
        { content: { contains: search } },
        { authorName: { contains: search } },
      ],
    } : {}),
  };

  const posts = await prisma.tareeqPost.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, title: true, summary: true, content: true,
      category: true, tags: true, imageUrl: true, videoUrl: true, authorName: true,
      likeCount: true, commentCount: true, createdAt: true, userId: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ posts: items, nextCursor });
}

// POST /api/tareeq — create a new علامة
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = checkRateLimit(`tareeq:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? '').trim();
  const title = String(body.title ?? '').trim() || null;
  const summary = String(body.summary ?? '').trim() || null;

  // Normalize category to canonical English key
  const rawCategory = String(body.category ?? '').trim();
  const category = rawCategory ? (CATEGORY_KEY[rawCategory] ?? null) : null;

  // Validate tags — strings only, max 50 chars each, max 10 tags
  const rawTags = body.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 10)
    : null;

  if (content.length < 10) {
    return NextResponse.json({ error: 'اكتب أكثر (10 أحرف على الأقل)' }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: 'النص طويل جداً (5000 حرف كحد أقصى)' }, { status: 400 });
  }

  // Media URLs (already uploaded via /api/tareeq/upload)
  const imageUrl = String(body.imageUrl ?? '').trim() || null;
  const videoUrl = String(body.videoUrl ?? '').trim() || null;

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true, avatarUrl: true } });

  const post = await prisma.tareeqPost.create({
    data: {
      content,
      title,
      summary,
      category,
      tags,
      imageUrl,
      videoUrl,
      userId: user.userId,
      authorName: dbUser?.name ?? 'مجهول',
    },
  });

  return NextResponse.json({ ok: true, id: post.id });
}
