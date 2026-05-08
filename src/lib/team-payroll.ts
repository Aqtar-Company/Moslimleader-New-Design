import { prisma } from './prisma';
import { PAYROLL_FACTORS, type EmploymentTypeKey } from './team-roles';

// Aggregate payroll figures used by the valuation report (subtracts
// from earnings to approximate EBITDA) and by the Zakat calculator
// (annualised salaries owed but not yet paid would be a liability —
// we don't track unpaid salary today, so this is informational only).

export interface PayrollSummary {
  headcount: number;
  fullTimeCount: number;
  partTimeCount: number;
  consultantCount: number;
  contractorCount: number;
  monthlyPayrollNominal: number; // straight Σ monthlySalary, no factors
  monthlyPayrollAdjusted: number; // weighted by PAYROLL_FACTORS
  annualPayrollNominal: number;
  annualPayrollAdjusted: number;
}

export async function getPayrollSummary(): Promise<PayrollSummary> {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { employmentType: true, monthlySalary: true },
  });

  let monthlyNominal = 0;
  let monthlyAdjusted = 0;
  let fullTime = 0;
  let partTime = 0;
  let consultant = 0;
  let contractor = 0;

  for (const e of employees) {
    const sal = Number(e.monthlySalary) || 0;
    monthlyNominal += sal;
    const factor = PAYROLL_FACTORS[e.employmentType as EmploymentTypeKey] ?? 1;
    monthlyAdjusted += sal * factor;
    switch (e.employmentType) {
      case 'full-time':  fullTime++; break;
      case 'part-time':  partTime++; break;
      case 'consultant': consultant++; break;
      case 'contractor': contractor++; break;
    }
  }

  return {
    headcount: employees.length,
    fullTimeCount: fullTime,
    partTimeCount: partTime,
    consultantCount: consultant,
    contractorCount: contractor,
    monthlyPayrollNominal: Math.round(monthlyNominal),
    monthlyPayrollAdjusted: Math.round(monthlyAdjusted),
    annualPayrollNominal: Math.round(monthlyNominal * 12),
    annualPayrollAdjusted: Math.round(monthlyAdjusted * 12),
  };
}
