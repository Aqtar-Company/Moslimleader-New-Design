export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/tareeq/export?types=posts,notes,bookmarks,comments&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // 3 exports per hour — exporting is DB-heavy
  const limited = checkRateLimit(`tareeq-export:${user.userId}`, 3, 60 * 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: 'جرّب مرة أخرى بعد ساعة' }, { status: 429 });

  const { searchParams } = req.nextUrl;
  const rawTypes = searchParams.get('types') ?? 'posts,notes,bookmarks,comments';
  const types = rawTypes.split(',').map(t => t.trim()).filter(Boolean);

  const fromParam = searchParams.get('from');
  const toParam   = searchParams.get('to');
  const from = fromParam ? new Date(fromParam) : undefined;
  const to   = toParam   ? new Date(toParam + 'T23:59:59Z') : undefined;

  // Validate dates
  if (from && isNaN(from.getTime())) return NextResponse.json({ error: 'تاريخ البداية غير صحيح' }, { status: 400 });
  if (to   && isNaN(to.getTime()))   return NextResponse.json({ error: 'تاريخ النهاية غير صحيح'  }, { status: 400 });
  const dateFilter = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const hasDate = !!from || !!to;

  const result: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    platform: 'طريق — مسلم ليدر',
  };

  await Promise.all([
    types.includes('posts') && prisma.tareeqPost.findMany({
      where: { userId: user.userId, ...(hasDate ? { createdAt: dateFilter } : {}) },
      select: {
        id: true, content: true, title: true, summary: true,
        category: true, tags: true, imageUrl: true, imageUrls: true,
        videoUrl: true, likeCount: true, commentCount: true,
        viewCount: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }).then((rows: unknown[]) => { result.posts = rows; }),

    types.includes('notes') && prisma.tareeqNote.findMany({
      where: { userId: user.userId, ...(hasDate ? { createdAt: dateFilter } : {}) },
      select: { id: true, title: true, content: true, imageUrl: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }).then((rows: unknown[]) => { result.notes = rows; }),

    types.includes('bookmarks') && prisma.tareeqBookmark.findMany({
      where: { userId: user.userId, ...(hasDate ? { createdAt: dateFilter } : {}) },
      select: {
        id: true, postId: true, createdAt: true,
        folder: { select: { name: true } },
        post: { select: { content: true, title: true, imageUrl: true, authorName: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }).then((rows: unknown[]) => { result.bookmarks = rows; }),

    types.includes('comments') && prisma.tareeqComment.findMany({
      where: { userId: user.userId, ...(hasDate ? { createdAt: dateFilter } : {}) },
      select: { id: true, postId: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }).then((rows: unknown[]) => { result.comments = rows; }),
  ].filter(Boolean));

  const json     = JSON.stringify(result, null, 2);
  const filename = `tareeq-export-${new Date().toISOString().split('T')[0]}.json`;

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
