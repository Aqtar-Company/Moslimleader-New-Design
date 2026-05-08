'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';
import { TEAM_ROLES, EMPLOYMENT_TYPES, roleLabel, employmentLabel } from '@/lib/team-roles';

interface Employee {
  id: string;
  name: string;
  role: string;
  customRole: string | null;
  employmentType: string;
  monthlySalary: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

interface PayrollSummary {
  headcount: number;
  fullTimeCount: number;
  partTimeCount: number;
  consultantCount: number;
  contractorCount: number;
  monthlyPayrollNominal: number;
  monthlyPayrollAdjusted: number;
  annualPayrollNominal: number;
  annualPayrollAdjusted: number;
}

interface FormState {
  id?: string;
  name: string;
  role: string;
  customRole: string;
  employmentType: string;
  monthlySalary: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes: string;
  contactPhone: string;
  contactEmail: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => `${fmt(n)} ج.م`;
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB') : '—';

const blankForm = (): FormState => ({
  name: '', role: 'execution-officer', customRole: '', employmentType: 'full-time',
  monthlySalary: '', startDate: new Date().toISOString().slice(0, 10),
  endDate: '', isActive: true, notes: '', contactPhone: '', contactEmail: '',
});

const EMPLOYMENT_TONE: Record<string, string> = {
  'full-time':  'bg-emerald-100 text-emerald-700',
  'part-time':  'bg-amber-100 text-amber-700',
  'consultant': 'bg-blue-100 text-blue-700',
  'contractor': 'bg-purple-100 text-purple-700',
};

export default function TeamPage() {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all' | 'inactive'>('active');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/team');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setEmployees(data.employees);
      setPayroll(data.payroll);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return employees;
    if (filter === 'active') return employees.filter(e => e.isActive);
    return employees.filter(e => !e.isActive);
  }, [employees, filter]);

  const openAdd = () => setForm(blankForm());
  const openEdit = (e: Employee) => setForm({
    id: e.id,
    name: e.name,
    role: e.role,
    customRole: e.customRole ?? '',
    employmentType: e.employmentType,
    monthlySalary: String(e.monthlySalary),
    startDate: e.startDate.slice(0, 10),
    endDate: e.endDate ? e.endDate.slice(0, 10) : '',
    isActive: e.isActive,
    notes: e.notes ?? '',
    contactPhone: e.contactPhone ?? '',
    contactEmail: e.contactEmail ?? '',
  });

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { addToast('الاسم مطلوب', 'warning'); return; }
    setSaving(true);
    try {
      const url = form.id ? `/api/admin/team/${form.id}` : '/api/admin/team';
      const method = form.id ? 'PATCH' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          role: form.role,
          customRole: form.customRole,
          employmentType: form.employmentType,
          monthlySalary: Number(form.monthlySalary) || 0,
          startDate: form.startDate,
          endDate: form.endDate || null,
          isActive: form.isActive,
          notes: form.notes,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
        }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); setSaving(false); return; }
      addToast(form.id ? 'تم التحديث' : 'تمت الإضافة', 'success');
      setForm(null);
      load();
    } catch {
      addToast('فشل الحفظ', 'error');
    }
    setSaving(false);
  };

  const remove = async (e: Employee) => {
    if (!confirm(`حذف ${e.name}؟ (الأفضل وضعه "غير نشط" لو ساب الشركة، عشان السجل يبقى موجود)`)) return;
    try {
      const res = await adminFetch(`/api/admin/team/${e.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحذف', 'error'); return; }
      addToast('تم الحذف', 'success');
      load();
    } catch {
      addToast('فشل الحذف', 'error');
    }
  };

  if (forbidden) return <ForbiddenState requiredPerm="team.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-purple-700 via-indigo-700 to-[#1a1a2e] rounded-2xl p-4 sm:p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">👥 الفريق والرواتب</h1>
            <p className="text-white/85 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              دليل الموظفين والمستشارين وطبيعة عملهم. الأرقام هنا تدخل تلقائياً في تقرير تقييم الشركة (مصروفات تشغيلية)
              وفي حاسبة الزكاة (الرواتب المستحقة كالتزامات).
            </p>
          </div>
          <button onClick={openAdd} className="px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition shrink-0">
            + إضافة عضو
          </button>
        </div>
        {payroll && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            <Stat label="إجمالي الفريق" value={fmt(payroll.headcount)} sub={`${fmt(payroll.fullTimeCount)} كامل · ${fmt(payroll.partTimeCount)} جزئي`} />
            <Stat label="استشاريون" value={fmt(payroll.consultantCount + payroll.contractorCount)} sub="استشاري + متعاقد" />
            <Stat label="رواتب شهرية (اسمية)" value={fmtMoney(payroll.monthlyPayrollNominal)} />
            <Stat label="عبء سنوي معدَّل" value={fmtMoney(payroll.annualPayrollAdjusted)} highlight sub="معامل تخفيض للاستشاريين" />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {([
          { k: 'active',   label: 'نشطون' },
          { k: 'all',      label: 'الكل' },
          { k: 'inactive', label: 'غير نشطون' },
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === f.k ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState message="مفيش أعضاء — اضغط '+ إضافة عضو' للبدء" icon="👥" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(e => {
            const tone = EMPLOYMENT_TONE[e.employmentType] ?? 'bg-gray-100 text-gray-700';
            const role = TEAM_ROLES.find(r => r.key === e.role);
            return (
              <div key={e.id} className={`bg-white border rounded-2xl p-4 ${e.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0">{role?.icon ?? '👤'}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{e.name}</p>
                      <p className="text-[11px] text-gray-500">{roleLabel(e.role, e.customRole)}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tone} shrink-0`}>{employmentLabel(e.employmentType)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                  <div>
                    <p className="text-gray-500">الراتب الشهري</p>
                    <p className="font-black text-gray-900 text-base">{fmtMoney(e.monthlySalary)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">بدأ</p>
                    <p className="font-bold text-gray-700">{fmtDate(e.startDate)}</p>
                  </div>
                </div>

                {(e.contactPhone || e.contactEmail) && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500 space-y-0.5">
                    {e.contactPhone && <p dir="ltr">📞 {e.contactPhone}</p>}
                    {e.contactEmail && <p dir="ltr">📧 {e.contactEmail}</p>}
                  </div>
                )}

                {e.notes && <p className="text-[10px] text-gray-500 mt-2 leading-relaxed border-t border-gray-100 pt-2">{e.notes}</p>}

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(e)} className="flex-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition">✏️ تعديل</button>
                  <button onClick={() => remove(e)} className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold transition">🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-500 text-center">
        💡 أرقام الرواتب من هنا بتدخل في حساب EBITDA في{' '}
        <Link href="/admin/valuation" className="text-blue-700 hover:underline">تقييم الشركة</Link>
      </p>

      {/* Add/Edit modal */}
      {form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-black text-gray-900">{form.id ? 'تعديل عضو' : 'إضافة عضو'}</h2>
                <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="الاسم *">
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="الدور *">
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {TEAM_ROLES.map(r => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
                  </select>
                </Field>
                {form.role === 'other' && (
                  <Field label="اسم الدور">
                    <input value={form.customRole} onChange={e => setForm({ ...form, customRole: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </Field>
                )}
                <Field label="نوع الدوام *">
                  <select value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {EMPLOYMENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                  </select>
                </Field>
                <Field label="الراتب الشهري (ج.م)">
                  <input type="number" min="0" step="0.01" value={form.monthlySalary} onChange={e => setForm({ ...form, monthlySalary: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="تاريخ البدء *">
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="تاريخ الانتهاء (اختياري)">
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="تليفون">
                  <input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="إيميل">
                  <input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
              </div>

              <Field label="ملاحظات">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </Field>

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                نشط (يحتسب في الرواتب الشهرية)
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => setForm(null)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold">إلغاء</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-black transition disabled:opacity-50">
                  {saving ? '...جاري الحفظ' : '💾 حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}>
      <p className="text-[10px] text-white/60 font-bold tracking-widest">{label}</p>
      <p className={`text-lg sm:text-xl font-black mt-1 ${highlight ? 'text-[#F5C518]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[9px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 font-bold mb-1">{label}</label>
      {children}
    </div>
  );
}
