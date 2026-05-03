export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      recipients: {
        select: {
          id: true, email: true, status: true, sentAt: true,
          openedAt: true, clickedAt: true, errorMessage: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: 'desc' },
        take: 200,
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 });
  if (campaign.status === 'sending') {
    return NextResponse.json({ error: 'لا يمكن حذف حملة قيد الإرسال' }, { status: 400 });
  }
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
