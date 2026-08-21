export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const user = await getAuthUser().catch(() => null);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'PENDING';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = 20;

  const where = status === 'all' ? {} : { status: status as 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED' };

  const [total, reports] = await Promise.all([
    prisma.tareeqReport.count({ where }),
    prisma.tareeqReport.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        targetPost: { select: { id: true, content: true, isHidden: true, authorName: true } },
        targetComment: { select: { id: true, content: true, isHidden: true } },
        targetUser: { select: { id: true, name: true, email: true, tareeqSuspended: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ reports, total, page, limit });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, action, resolution } = await req.json().catch(() => ({}));
  if (!id || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const report = await prisma.tareeqReport.findUnique({
    where: { id },
    include: {
      targetPost: true,
      targetComment: true,
      targetUser: true,
    },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date();
  let newStatus: 'REVIEWED' | 'RESOLVED' | 'DISMISSED' = 'REVIEWED';

  if (action === 'dismiss') {
    newStatus = 'DISMISSED';
    await prisma.tareeqReport.update({
      where: { id },
      data: { status: 'DISMISSED', reviewedBy: admin.userId, reviewedAt: now, resolution: resolution ?? 'رُفض البلاغ' },
    });
  } else if (action === 'hide_post' && report.targetPostId) {
    newStatus = 'RESOLVED';
    await prisma.$transaction([
      prisma.tareeqPost.update({
        where: { id: report.targetPostId },
        data: { isHidden: true, hiddenBy: admin.userId, hiddenReason: resolution ?? 'مخالف للسياسات' },
      }),
      prisma.tareeqReport.update({
        where: { id },
        data: { status: 'RESOLVED', reviewedBy: admin.userId, reviewedAt: now, resolution: resolution ?? 'تم إخفاء المنشور' },
      }),
    ]);
  } else if (action === 'delete_post' && report.targetPostId) {
    newStatus = 'RESOLVED';
    await prisma.$transaction([
      prisma.tareeqPost.delete({ where: { id: report.targetPostId } }),
      prisma.tareeqReport.update({
        where: { id },
        data: { status: 'RESOLVED', reviewedBy: admin.userId, reviewedAt: now, resolution: resolution ?? 'تم حذف المنشور' },
      }),
    ]);
  } else if (action === 'hide_comment' && report.targetCommentId) {
    newStatus = 'RESOLVED';
    await prisma.$transaction([
      prisma.tareeqComment.update({
        where: { id: report.targetCommentId },
        data: { isHidden: true, hiddenBy: admin.userId },
      }),
      prisma.tareeqReport.update({
        where: { id },
        data: { status: 'RESOLVED', reviewedBy: admin.userId, reviewedAt: now, resolution: resolution ?? 'تم إخفاء التعليق' },
      }),
    ]);
  } else if (action === 'suspend_user' && report.targetUserId) {
    newStatus = 'RESOLVED';
    await prisma.$transaction([
      prisma.user.update({
        where: { id: report.targetUserId },
        data: { tareeqSuspended: true, tareeqSuspendedAt: now, tareeqSuspendReason: resolution ?? 'مخالف للسياسات' },
      }),
      prisma.tareeqReport.update({
        where: { id },
        data: { status: 'RESOLVED', reviewedBy: admin.userId, reviewedAt: now, resolution: resolution ?? 'تم تعليق المستخدم' },
      }),
    ]);
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, newStatus });
}
