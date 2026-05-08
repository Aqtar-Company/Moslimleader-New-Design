export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { TEAM_ROLES, EMPLOYMENT_TYPES } from '@/lib/team-roles';

const VALID_ROLES: Set<string> = new Set(TEAM_ROLES.map(r => r.key));
const VALID_TYPES: Set<string> = new Set(EMPLOYMENT_TYPES.map(t => t.key));

interface PatchInput {
  name?: string; role?: string; customRole?: string; employmentType?: string;
  monthlySalary?: number; startDate?: string; endDate?: string | null;
  isActive?: boolean; notes?: string; contactPhone?: string; contactEmail?: string;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('team.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });

  let body: PatchInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    data.name = n;
  }
  if (body.role !== undefined) {
    if (!VALID_ROLES.has(body.role)) return NextResponse.json({ error: 'الدور غير صالح' }, { status: 400 });
    data.role = body.role;
    data.customRole = body.role === 'other' ? (body.customRole?.trim() || null) : null;
  }
  if (body.employmentType !== undefined) {
    if (!VALID_TYPES.has(body.employmentType)) return NextResponse.json({ error: 'نوع الدوام غير صالح' }, { status: 400 });
    data.employmentType = body.employmentType;
  }
  if (body.monthlySalary !== undefined) {
    const s = Number(body.monthlySalary);
    if (!Number.isFinite(s) || s < 0) return NextResponse.json({ error: 'الراتب غير صحيح' }, { status: 400 });
    data.monthlySalary = Math.round(s * 100) / 100;
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
  if (body.notes !== undefined) data.notes = body.notes.trim() || null;
  if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone.trim() || null;
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail.trim() || null;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'لا تغييرات' }, { status: 400 });

  const updated = await prisma.employee.update({ where: { id }, data });
  await logActionSafe({
    actor: guard.user, action: 'team.update',
    entity: 'Employee', entityId: id, before: existing, after: updated,
  });
  return NextResponse.json({ ok: true, employee: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm('team.write');
  if ('response' in guard) return guard.response;
  const { id } = await params;

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });

  await prisma.employee.delete({ where: { id } });
  await logActionSafe({
    actor: guard.user, action: 'team.delete',
    entity: 'Employee', entityId: id, before: existing,
  });
  return NextResponse.json({ ok: true });
}
