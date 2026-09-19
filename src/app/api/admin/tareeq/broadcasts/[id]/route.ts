export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { logActionSafe } from '@/lib/audit-log';
import { Prisma } from '@prisma/client';
import { BROADCAST_LIST_SELECT, parseBroadcastInput } from '@/lib/admin-broadcast';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// GET /api/admin/tareeq/broadcasts/[id]?recipients=failed|all&page=1
// The broadcast plus a page of its recipients — the per-person delivery report.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id: params.id }, select: BROADCAST_LIST_SELECT });
  if (!broadcast) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });

  const url = new URL(req.url);
  const filter = url.searchParams.get('recipients') || 'all';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 50;
  const where = {
    broadcastId: params.id,
    ...(filter === 'failed' ? { status: 'failed' } : filter === 'queued' ? { status: { in: ['queued', 'processing'] } } : {}),
  };
  const [total, recipients, readCount] = await Promise.all([
    prisma.adminBroadcastRecipient.count({ where }),
    prisma.adminBroadcastRecipient.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // createMany gives 100 rows one createdAt
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, userId: true, email: true, status: true, inAppSent: true, pushSent: true,
        emailStatus: true, error: true, readAt: true,
        user: { select: { name: true, avatarUrl: true } },
      },
    }),
    prisma.adminBroadcastRecipient.count({ where: { broadcastId: params.id, readAt: { not: null } } }),
  ]);

  // Names of the hand-picked list, for the compose screen's "duplicate" action.
  let targets: { id: string; name: string; email: string }[] = [];
  if (broadcast.audience === 'selected' && Array.isArray(broadcast.targetUserIds)) {
    const ids = (broadcast.targetUserIds as unknown[]).filter((x): x is string => typeof x === 'string');
    targets = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  }

  return NextResponse.json({ broadcast, recipients, total, page, limit, readCount, targets });
}

// PATCH /api/admin/tareeq/broadcasts/[id] — edit a DRAFT. Anything already sent is history.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.adminBroadcast.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!existing) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  if (existing.status !== 'draft') return NextResponse.json({ error: 'لا يمكن تعديل رسالة بعد بدء إرسالها — أنشئ نسخة جديدة' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
  const parsed = parseBroadcastInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const broadcast = await prisma.adminBroadcast.update({
    where: { id: params.id },
    // `null` must CLEAR the list — switching a draft from a hand-picked list to `all` used
    // to keep the stale ids in the row.
    // `DbNull` writes SQL NULL; `JsonNull` would write the JSON literal `null` into the column.
    data: { ...parsed.data, targetUserIds: parsed.data.targetUserIds ?? Prisma.DbNull },
    select: BROADCAST_LIST_SELECT,
  });
  return NextResponse.json({ broadcast });
}

// DELETE /api/admin/tareeq/broadcasts/[id]
// Drafts vanish. A sent broadcast is deleted together with its recipient rows (cascade),
// but the in-app notifications members already received stay — a message that was
// delivered was delivered; the record of it should not disappear from their screens.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.adminBroadcast.findUnique({ where: { id: params.id }, select: { status: true, title: true, kind: true } });
  if (!existing) return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  if (existing.status === 'sending') return NextResponse.json({ error: 'أوقف الإرسال أولاً' }, { status: 400 });

  await prisma.adminBroadcast.delete({ where: { id: params.id } });
  await logActionSafe({
    actor: admin,
    action: 'tareeq.broadcast.delete',
    entity: 'AdminBroadcast',
    entityId: params.id,
    metadata: { title: existing.title, kind: existing.kind, status: existing.status },
  });
  return NextResponse.json({ ok: true });
}
