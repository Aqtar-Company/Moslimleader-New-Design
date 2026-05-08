export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

interface PatchInput {
  payeeName?: string;
  contactPhone?: string;
  contactEmail?: string;
  percentage?: number;
  productIds?: string[];
  startDate?: string;
  endDate?: string | null;
  isActive?: boolean;
  lastPaidAt?: string | null;
  markPaidNow?: boolean; // shortcut for "mark paid now"
  notes?: string;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('ip.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const existing = await prisma.royaltyAgreement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'الاتفاقية غير موجودة' }, { status: 404 });

  let body: PatchInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const data: Record<string, unknown> = {};
  if (body.payeeName !== undefined) {
    const n = body.payeeName.trim();
    if (!n) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    data.payeeName = n;
  }
  if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone.trim() || null;
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail.trim() || null;
  if (body.percentage !== undefined) {
    const p = Number(body.percentage);
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return NextResponse.json({ error: 'النسبة يجب أن تكون بين 0 و 100' }, { status: 400 });
    }
    data.percentage = Math.round(p * 100) / 100;
  }
  if (body.productIds !== undefined) {
    const ids = Array.isArray(body.productIds)
      ? body.productIds.filter(x => typeof x === 'string')
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'يجب اختيار منتج واحد على الأقل' }, { status: 400 });
    }
    data.productIds = ids;
  }
  if (body.startDate !== undefined) {
    const d = new Date(body.startDate);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'تاريخ البدء غير صحيح' }, { status: 400 });
    data.startDate = d;
  }
  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (body.markPaidNow) {
    data.lastPaidAt = new Date();
  } else if (body.lastPaidAt !== undefined) {
    data.lastPaidAt = body.lastPaidAt ? new Date(body.lastPaidAt) : null;
  }
  if (body.notes !== undefined) data.notes = body.notes.trim() || null;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'لا تغييرات' }, { status: 400 });

  const updated = await prisma.royaltyAgreement.update({ where: { id }, data });
  await logActionSafe({
    actor: guard.user,
    action: 'royalty.update',
    entity: 'RoyaltyAgreement',
    entityId: id,
    before: existing,
    after: updated,
  });
  return NextResponse.json({ ok: true, agreement: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('ip.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const existing = await prisma.royaltyAgreement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'الاتفاقية غير موجودة' }, { status: 404 });

  await prisma.royaltyAgreement.delete({ where: { id } });
  await logActionSafe({
    actor: guard.user,
    action: 'royalty.delete',
    entity: 'RoyaltyAgreement',
    entityId: id,
    before: existing,
  });
  return NextResponse.json({ ok: true });
}
