// Predefined roles for the team / payroll directory. The set covers
// what the owner described; new roles can be captured as 'other' with
// a customRole free-text field.

export const TEAM_ROLES = [
  { key: 'accounts-manager',     label: 'مدير حسابات',       icon: '📊' },
  { key: 'warehouse-shipping',   label: 'مدير مخازن وشحن',   icon: '📦' },
  { key: 'social-media',         label: 'إدارة وسائل التواصل', icon: '📱' },
  { key: 'author',               label: 'مؤلِّف',             icon: '✍️' },
  { key: 'designer',             label: 'مصمم',               icon: '🎨' },
  { key: 'execution-officer',    label: 'مسؤول تنفيذ',        icon: '⚙️' },
  { key: 'consultant',           label: 'استشاري',            icon: '🧠' },
  { key: 'other',                label: 'أخرى',               icon: '👤' },
] as const;

export type TeamRoleKey = typeof TEAM_ROLES[number]['key'];

export const EMPLOYMENT_TYPES = [
  { key: 'full-time',   label: 'دوام كامل',  icon: '🟢' },
  { key: 'part-time',   label: 'دوام جزئي',  icon: '🟡' },
  { key: 'consultant',  label: 'استشاري',     icon: '🧠' },
  { key: 'contractor',  label: 'متعاقد بالقطعة', icon: '🤝' },
] as const;

export type EmploymentTypeKey = typeof EMPLOYMENT_TYPES[number]['key'];

// When we surface payroll in the valuation report, consultant /
// contractor staff aren't a fixed monthly burn the way full-time is.
// We multiply their nominal monthly fee by these factors so the
// "annual payroll" aggregate doesn't overstate. Owner can override
// per-employee in a future version.
export const PAYROLL_FACTORS: Record<EmploymentTypeKey, number> = {
  'full-time':   1.0,
  'part-time':   1.0, // they have a fixed part-time salary too — no haircut
  'consultant':  0.5, // assume ~50% utilisation as a realistic estimate
  'contractor':  0.25, // ad-hoc piece work; lowest expected recurrence
};

export function roleLabel(key: string, customRole?: string | null): string {
  if (key === 'other' && customRole) return customRole;
  return TEAM_ROLES.find(r => r.key === key)?.label ?? key;
}

export function employmentLabel(key: string): string {
  return EMPLOYMENT_TYPES.find(t => t.key === key)?.label ?? key;
}
