export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { resolveSegment, type SegmentFilters } from '@/lib/marketing';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, channel: true, segmentKey: true, subject: true,
      couponCode: true, status: true, recipientCount: true, sentCount: true,
      openedCount: true, clickedCount: true, conversionCount: true,
      createdAt: true, finishedAt: true,
    },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const body = await req.json();
  const { name, segmentKey, segmentFilters, subject, bodyHtml, couponCode } = body as {
    name?: string;
    segmentKey?: string;
    segmentFilters?: SegmentFilters;
    subject?: string;
    bodyHtml?: string;
    couponCode?: string | null;
  };

  if (!name?.trim() || !subject?.trim() || !bodyHtml?.trim()) {
    return NextResponse.json({ error: 'الاسم، الموضوع، والمحتوى مطلوبين' }, { status: 400 });
  }

  // Pre-resolve count for the admin to confirm before sending.
  const recipients = await resolveSegment(segmentKey || 'all', segmentFilters || {});
  const reachable = recipients.filter(r => r.marketingOptIn && r.email);

  const campaign = await prisma.campaign.create({
    data: {
      name: name.trim(),
      channel: 'email',
      segmentKey: segmentKey || 'all',
      segmentFilters: segmentFilters as object | undefined,
      subject: subject.trim(),
      bodyHtml,
      couponCode: couponCode?.trim() || null,
      status: 'draft',
      recipientCount: reachable.length,
    },
  });

  return NextResponse.json({ campaign });
}
