export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSegment, type SegmentFilters } from '@/lib/marketing';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

export async function GET() {
  const guard = await requirePerm(['campaigns.read', 'campaigns.write'] as Permission[]);
  if ('response' in guard) return guard.response;

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
  const guard = await requirePerm('campaigns.write');
  if ('response' in guard) return guard.response;
  const auth = guard.user;

  const body = await req.json();
  const { name, segmentKey, segmentFilters, subject, bodyText, bodyHtml, couponCode, ctaLabel, ctaUrl, dailyLimit } = body as {
    name?: string;
    segmentKey?: string;
    segmentFilters?: SegmentFilters;
    subject?: string;
    bodyText?: string;     // new authoritative field
    bodyHtml?: string;     // legacy / pre-rendered (still accepted)
    couponCode?: string | null;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    dailyLimit?: number;
  };

  // Either bodyText (new flow) or bodyHtml (legacy) must be present.
  if (!name?.trim() || !subject?.trim() || (!bodyText?.trim() && !bodyHtml?.trim())) {
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
      // bodyText is the source of truth when present; bodyHtml stays for
      // already-saved campaigns and as a non-null placeholder until the
      // send loop renders it.
      bodyText: bodyText?.trim() || null,
      bodyHtml: bodyHtml?.trim() || (bodyText?.trim() ?? ''),
      // Normalize to UPPERCASE so order.couponCode (also normalized at write)
      // matches the campaign for conversion attribution regardless of how the
      // admin or customer typed it.
      couponCode: couponCode?.trim().toUpperCase() || null,
      ctaLabel: ctaLabel?.trim() || null,
      ctaUrl: ctaUrl?.trim() || null,
      dailyLimit: typeof dailyLimit === 'number' && dailyLimit > 0 ? Math.min(50, Math.floor(dailyLimit)) : 5,
      status: 'draft',
      recipientCount: reachable.length,
      createdByUserId: auth.userId,
    },
  });

  await logActionSafe({
    actor: auth,
    action: 'campaign.create',
    entity: 'Campaign',
    entityId: campaign.id,
    after: { name: campaign.name, recipientCount: campaign.recipientCount, segmentKey: campaign.segmentKey },
  });

  return NextResponse.json({ campaign });
}
