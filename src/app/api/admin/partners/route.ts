export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { getPartnersReport } from '@/lib/partners';

const VALID_TYPES = new Set(['founder', 'investor', 'silent-partner', 'other']);

export async function GET() {
  const guard = await requirePerm('partners.read');
  if ('response' in guard) return guard.response;
  const data = await getPartnersReport();
  return NextResponse.json(data);
}

interface PartnerInput {
  name?: string;
  type?: string;
  stakePercentage?: number;
  capitalContribution?: number;
  joinDate?: string;
  exitDate?: string | null;
  isActive?: boolean;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

function validate(body: PartnerInput) {
  const name = body.name?.trim();
  if (!name) return { error: 'الاسم مطلوب' };
  if (!body.type || !VALID_TYPES.has(body.type)) {
    return { error: 'نوع الشريك غير صالح' };
  }
  const stake = Number(body.stakePercentage);
  if (!Number.isFinite(stake) || stake <= 0 || stake > 100) {
    return { error: 'نسبة الحصة يجب أن تكون بين 0 و 100' };
  }
  const capital = Number(body.capitalContribution ?? 0);
  if (!Number.isFinite(capital) || capital < 0) {
    return { error: 'رأس المال غير صحيح' };
  }
  if (!body.joinDate) return { error: 'تاريخ الانضمام مطلوب' };
  const join = new Date(body.joinDate);
  if (Number.isNaN(join.getTime())) return { error: 'تاريخ الانضمام غير صحيح' };
  return {
    ok: true as const,
    data: {
      name,
      type: body.type,
      stakePercentage: Math.round(stake * 100) / 100,
      capitalContribution: Math.round(capital * 100) / 100,
      joinDate: join,
      exitDate: body.exitDate ? new Date(body.exitDate) : null,
      isActive: body.isActive ?? true,
      contactPhone: body.contactPhone?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  };
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm('partners.write');
  if ('response' in guard) return guard.response;

  let body: PartnerInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const v = validate(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const created = await prisma.partner.create({
    data: { ...v.data, createdByUserId: guard.user.userId },
  });
  await logActionSafe({
    actor: guard.user,
    action: 'partner.create',
    entity: 'Partner',
    entityId: created.id,
    after: created,
  });
  return NextResponse.json({ ok: true, partner: created });
}
