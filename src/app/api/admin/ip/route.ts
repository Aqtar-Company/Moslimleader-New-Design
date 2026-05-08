export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { getRoyaltiesReport } from '@/lib/royalties';

export async function GET() {
  const guard = await requirePerm('ip.read');
  if ('response' in guard) return guard.response;
  const data = await getRoyaltiesReport();
  return NextResponse.json(data);
}

interface AgreementInput {
  payeeName?: string;
  contactPhone?: string;
  contactEmail?: string;
  percentage?: number;
  productIds?: string[];
  startDate?: string;
  endDate?: string | null;
  isActive?: boolean;
  lastPaidAt?: string | null;
  notes?: string;
}

function validate(body: AgreementInput) {
  const name = body.payeeName?.trim();
  if (!name) return { error: 'اسم المستحق مطلوب' };
  const pct = Number(body.percentage);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { error: 'النسبة يجب أن تكون بين 0 و 100' };
  }
  const ids = Array.isArray(body.productIds)
    ? body.productIds.filter(x => typeof x === 'string')
    : [];
  if (ids.length === 0) {
    return { error: 'يجب اختيار منتج واحد على الأقل' };
  }
  if (!body.startDate) return { error: 'تاريخ البدء مطلوب' };
  const start = new Date(body.startDate);
  if (Number.isNaN(start.getTime())) {
    return { error: 'تاريخ البدء غير صحيح' };
  }
  return {
    ok: true as const,
    data: {
      payeeName: name,
      contactPhone: body.contactPhone?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
      percentage: Math.round(pct * 100) / 100,
      productIds: ids,
      startDate: start,
      endDate: body.endDate ? new Date(body.endDate) : null,
      isActive: body.isActive ?? true,
      lastPaidAt: body.lastPaidAt ? new Date(body.lastPaidAt) : null,
      notes: body.notes?.trim() || null,
    },
  };
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm('ip.write');
  if ('response' in guard) return guard.response;

  let body: AgreementInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const v = validate(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const created = await prisma.royaltyAgreement.create({
    data: { ...v.data, createdByUserId: guard.user.userId },
  });
  await logActionSafe({
    actor: guard.user,
    action: 'royalty.create',
    entity: 'RoyaltyAgreement',
    entityId: created.id,
    after: created,
  });
  return NextResponse.json({ ok: true, agreement: created });
}
