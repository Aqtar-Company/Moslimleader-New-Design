export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';
import { TEAM_ROLES, EMPLOYMENT_TYPES } from '@/lib/team-roles';
import { getPayrollSummary } from '@/lib/team-payroll';

const VALID_ROLES: Set<string> = new Set(TEAM_ROLES.map(r => r.key));
const VALID_TYPES: Set<string> = new Set(EMPLOYMENT_TYPES.map(t => t.key));

export async function GET() {
  const guard = await requirePerm('team.read');
  if ('response' in guard) return guard.response;

  const [employees, payroll] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    }),
    getPayrollSummary(),
  ]);
  return NextResponse.json({ employees, payroll });
}

interface EmployeeInput {
  name?: string; role?: string; customRole?: string; employmentType?: string;
  monthlySalary?: number; startDate?: string; endDate?: string | null;
  isActive?: boolean; notes?: string; contactPhone?: string; contactEmail?: string;
}

function validate(body: EmployeeInput) {
  const name = body.name?.trim();
  if (!name) return { error: 'الاسم مطلوب' };
  if (!body.role || !VALID_ROLES.has(body.role)) return { error: 'الدور غير صالح' };
  if (!body.employmentType || !VALID_TYPES.has(body.employmentType)) return { error: 'نوع الدوام غير صالح' };
  const salary = Number(body.monthlySalary);
  if (!Number.isFinite(salary) || salary < 0) return { error: 'الراتب يجب أن يكون رقماً غير سالب' };
  if (salary > 10_000_000) return { error: 'الراتب يبدو مبالغاً فيه (>10M)' };
  if (!body.startDate) return { error: 'تاريخ البدء مطلوب' };
  const start = new Date(body.startDate);
  if (Number.isNaN(start.getTime())) return { error: 'تاريخ البدء غير صحيح' };
  return {
    ok: true as const,
    data: {
      name,
      role: body.role,
      customRole: body.role === 'other' ? (body.customRole?.trim() || null) : null,
      employmentType: body.employmentType,
      monthlySalary: Math.round(salary * 100) / 100,
      startDate: start,
      endDate: body.endDate ? new Date(body.endDate) : null,
      isActive: body.isActive ?? true,
      notes: body.notes?.trim() || null,
      contactPhone: body.contactPhone?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
    },
  };
}

export async function POST(req: NextRequest) {
  const guard = await requirePerm('team.write');
  if ('response' in guard) return guard.response;

  let body: EmployeeInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body غير صالح' }, { status: 400 }); }
  const v = validate(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const created = await prisma.employee.create({
    data: { ...v.data, createdByUserId: guard.user.userId },
  });
  await logActionSafe({
    actor: guard.user, action: 'team.create',
    entity: 'Employee', entityId: created.id, after: created,
  });
  return NextResponse.json({ ok: true, employee: created });
}
