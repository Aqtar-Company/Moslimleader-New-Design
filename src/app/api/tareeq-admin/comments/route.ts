export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tareeq-admin-auth';
import { TareeqAdminRole } from '@prisma/client';

const ALLOWED = [TareeqAdminRole.SUPER_ADMIN, TareeqAdminRole.MODERATOR];

// GET /api/tareeq-admin/comments?page=1&limit=20&hidden=all|visible|hidden&q=xxx
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, ALLOWED);
  } catch (e) {
    return e as Response;
  }

  const { searchParams } = new URL(request.url);
  const q      = searchParams.get('q') ?? '';
  const page   = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit  = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')));
  const hidden = searchParams.get('hidden') ?? 'all';

  const where: Record<string, unknown> = {};
  if (q) where.content = { contains: q };
  if (hidden === 'visible') where.isHidden = false;
  if (hidden === 'hidden')  where.isHidden = true;

  const [comments, total] = await Promise.all([
    prisma.tareeqComment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, content: true, isHidden: true, hiddenBy: true, createdAt: true,
        postId: true,
        post: { select: { id: true, title: true, content: true } },
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.tareeqComment.count({ where }),
  ]);

  return Response.json({ comments, total, pages: Math.ceil(total / limit) });
}
