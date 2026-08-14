export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';

// GET /api/tareeq-admin/posts
// Params: q, page, limit=20, hidden (all|visible|hidden), category
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (e) {
    return e as Response;
  }

  const { searchParams } = new URL(request.url);
  const q        = searchParams.get('q') ?? '';
  const page     = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit    = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '20')));
  const hidden   = searchParams.get('hidden') ?? 'all'; // all | visible | hidden
  const category = searchParams.get('category') ?? '';

  const where: Record<string, unknown> = {};
  if (q)                  where.content  = { contains: q };
  if (hidden === 'visible') where.isHidden = false;
  if (hidden === 'hidden')  where.isHidden = true;
  if (category)           where.category = category;

  const [posts, total] = await Promise.all([
    prisma.tareeqPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.tareeqPost.count({ where }),
  ]);

  return Response.json({ posts, total, pages: Math.ceil(total / limit) });
}
