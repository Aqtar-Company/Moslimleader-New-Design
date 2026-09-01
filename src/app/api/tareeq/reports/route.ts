export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { tareeqRateLimit } from '@/lib/tareeq-guard';

export async function POST(req: NextRequest) {
  const user = await getAuthUser().catch(() => null);
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

  // Previously unthrottled — an account could file unlimited reports against
  // many different targets, making coordinated brigading trivial.
  const rl = tareeqRateLimit('report', user.userId, 15, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'حاول لاحقاً' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const { targetType, targetId, reason, description } = body;

  if (!['post', 'comment', 'user'].includes(targetType)) {
    return NextResponse.json({ error: 'نوع بلاغ غير صحيح' }, { status: 400 });
  }
  if (!targetId || typeof targetId !== 'string') {
    return NextResponse.json({ error: 'معرف الهدف مطلوب' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return NextResponse.json({ error: 'سبب البلاغ مطلوب' }, { status: 400 });
  }

  // Avoid duplicate reports from the same user on the same content
  const existing = await prisma.tareeqReport.findFirst({
    where: { reporterId: user.userId, targetType, targetId },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    reporterId: user.userId,
    targetType,
    targetId,
    reason: reason.trim(),
    description: description?.trim() ?? null,
  };

  if (targetType === 'post') data.targetPostId = targetId;
  else if (targetType === 'comment') data.targetCommentId = targetId;
  else if (targetType === 'user') data.targetUserId = targetId;

  await prisma.tareeqReport.create({ data });

  return NextResponse.json({ ok: true });
}
