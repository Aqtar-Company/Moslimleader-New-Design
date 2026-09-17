export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';
import {
  BROADCAST_LIST_SELECT, parseBroadcastInput, queueBroadcast, runBroadcast, resumeOrphanedBroadcasts,
} from '@/lib/admin-broadcast';

const STATUSES = new Set(['draft', 'sending', 'sent', 'failed', 'canceled']);

/**
 * Admin broadcasts — list and create.
 *
 * Same guard as the sibling Tareeq admin routes (`role === 'admin'` via the shop JWT): the
 * page that calls this lives in the shop's admin panel, not the separate Tareeq moderator
 * console. Sending is a super-admin action for the same reason campaign sends are — it
 * reaches every member and costs SMTP reputation.
 */
async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// GET /api/admin/tareeq/broadcasts?page=1&status=sent
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const statusParam = url.searchParams.get('status');
  const status = statusParam && STATUSES.has(statusParam) ? statusParam : undefined;
  const limit = 20;
  const where = status ? { status } : {};

  // A send orphaned by a process restart sits at `sending` with nothing running it. The
  // admin opening this tab is the natural moment to pick it up again — no boot hook needed.
  void resumeOrphanedBroadcasts().catch(() => {});

  const [total, broadcasts] = await Promise.all([
    prisma.adminBroadcast.count({ where }),
    prisma.adminBroadcast.findMany({
      where,
      select: BROADCAST_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return NextResponse.json({ broadcasts, total, page, limit });
}

// POST /api/admin/tareeq/broadcasts — body: compose fields + { send?: boolean }
// `send: false` (or omitted) saves a draft; `send: true` saves and starts delivery.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  const parsed = parseBroadcastInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const broadcast = await prisma.adminBroadcast.create({
    data: {
      ...parsed.data,
      targetUserIds: parsed.data.targetUserIds ?? undefined,
      createdById: admin.userId,
      createdByName: admin.name || 'إدارة طريق',
    },
    select: BROADCAST_LIST_SELECT,
  });

  if (body.send !== true) return NextResponse.json({ broadcast });

  try {
    const queued = await queueBroadcast(broadcast.id);
    void runBroadcast(broadcast.id);
    await logActionSafe({
      actor: admin,
      action: 'tareeq.broadcast.send',
      entity: 'AdminBroadcast',
      entityId: broadcast.id,
      metadata: { kind: broadcast.kind, audience: broadcast.audience, title: broadcast.title, queued },
    });
    const fresh = await prisma.adminBroadcast.findUnique({ where: { id: broadcast.id }, select: BROADCAST_LIST_SELECT });
    return NextResponse.json({ broadcast: fresh, queued });
  } catch (e) {
    // The draft is kept so the admin can fix the audience and try again.
    return NextResponse.json({ error: (e as Error).message || 'تعذّر بدء الإرسال', broadcast }, { status: 400 });
  }
}
