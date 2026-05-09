export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

const VALID_TYPES = new Set(['founder', 'investor', 'silent-partner', 'other']);

interface PatchInput {
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('partners.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'الشريك غير موجود' }, { status: 404 });

  let body: PatchInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    data.name = n;
  }
  if (body.type !== undefined) {
    if (!VALID_TYPES.has(body.type)) return NextResponse.json({ error: 'نوع الشريك غير صالح' }, { status: 400 });
    data.type = body.type;
  }
  if (body.stakePercentage !== undefined) {
    const p = Number(body.stakePercentage);
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return NextResponse.json({ error: 'نسبة الحصة غير صحيحة' }, { status: 400 });
    }
    data.stakePercentage = Math.round(p * 100) / 100;
  }
  if (body.capitalContribution !== undefined) {
    const c = Number(body.capitalContribution);
    if (!Number.isFinite(c) || c < 0) return NextResponse.json({ error: 'رأس المال غير صحيح' }, { status: 400 });
    data.capitalContribution = Math.round(c * 100) / 100;
  }
  if (body.joinDate !== undefined) {
    const d = new Date(body.joinDate);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'تاريخ الانضمام غير صحيح' }, { status: 400 });
    data.joinDate = d;
  }
  if (body.exitDate !== undefined) {
    data.exitDate = body.exitDate ? new Date(body.exitDate) : null;
  }
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone.trim() || null;
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes.trim() || null;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'لا تغييرات' }, { status: 400 });

  const updated = await prisma.partner.update({ where: { id }, data });
  await logActionSafe({
    actor: guard.user,
    action: 'partner.update',
    entity: 'Partner',
    entityId: id,
    before: existing,
    after: updated,
  });
  return NextResponse.json({ ok: true, partner: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('partners.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'الشريك غير موجود' }, { status: 404 });

  await prisma.partner.delete({ where: { id } });
  await logActionSafe({
    actor: guard.user,
    action: 'partner.delete',
    entity: 'Partner',
    entityId: id,
    before: existing,
  });
  return NextResponse.json({ ok: true });
}
