'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Partner {
  id: string;
  name: string;
  type: string;
  stakePercentage: number;
  capitalContribution: number;
  joinDate: string;
  exitDate: string | null;
  isActive: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
}

interface Summary {
  totalCount: number;
  activeCount: number;
  totalStakePercentage: number;
  remainingCompanyShare: number;
  totalCapitalContribution: number;
  isOverCommitted: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  'founder': 'مؤسس',
  'investor': 'مستثمر',
  'silent-partner': 'شريك صامت',
  'other': 'أخرى',
};
const TYPE_TONE: Record<string, string> = {
  'founder': 'bg-purple-100 text-purple-700',
  'investor': 'bg-emerald-100 text-emerald-700',
  'silent-partner': 'bg-blue-100 text-blue-700',
  'other': 'bg-gray-100 text-gray-700',
};
const TYPE_COLOR: Record<string, string> = {
  'founder': 'bg-purple-600',
  'investor': 'bg-emerald-600',
  'silent-partner': 'bg-blue-600',
  'other': 'bg-gray-600',
};

interface FormState {
  id?: string;
  name: string;
  type: string;
  stakePercentage: string;
  capitalContribution: string;
  joinDate: string;
  exitDate: string;
  isActive: boolean;
  contactPhone: string;
  contactEmail: string;
  notes: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => `${fmt(n)} ج.م`;
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB') : '—';

const blankForm = (): FormState => ({
  name: '', type: 'founder', stakePercentage: '', capitalContribution: '',
  joinDate: new Date().toISOString().slice(0, 10),
  exitDate: '', isActive: true, contactPhone: '', contactEmail: '', notes: '',
});

export default function PartnersPage() {
  const { addToast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all' | 'inactive'>('active');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/partners');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setPartners(data.partners);
      setSummary(data.summary);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return partners;
    if (filter === 'active') return partners.filter(p => p.isActive);
    return partners.filter(p => !p.isActive);
  }, [partners, filter]);

  const activePartners = useMemo(() => partners.filter(p => p.isActive), [partners]);

  const openAdd = () => setForm(blankForm());
  const openEdit = (p: Partner) => setForm({
    id: p.id,
    name: p.name,
    type: p.type,
    stakePercentage: String(p.stakePercentage),
    capitalContribution: String(p.capitalContribution),
    joinDate: p.joinDate.slice(0, 10),
    exitDate: p.exitDate ? p.exitDate.slice(0, 10) : '',
    isActive: p.isActive,
    contactPhone: p.contactPhone ?? '',
    contactEmail: p.contactEmail ?? '',
    notes: p.notes ?? '',
  });

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { addToast('الاسم مطلوب', 'warning'); return; }
    const stake = Number(form.stakePercentage);
    if (!Number.isFinite(stake) || stake <= 0 || stake > 100) {
      addToast('نسبة الحصة بين 0 و 100', 'warning'); return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/admin/partners/${form.id}` : '/api/admin/partners';
      const method = form.id ? 'PATCH' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          stakePercentage: stake,
          capitalContribution: Number(form.capitalContribution) || 0,
          joinDate: form.joinDate,
          exitDate: form.exitDate || null,
          isActive: form.isActive,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          notes: form.notes,
        }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); setSaving(false); return; }
      addToast(form.id ? 'تم التحديث' : 'تمت الإضافة', 'success');
      setForm(null);
      load();
    } catch { addToast('فشل الحفظ', 'error'); }
    setSaving(false);
  };

  const remove = async (p: Partner) => {
    if (!confirm(`حذف الشريك ${p.name}؟ (الأفضل وضعه "غير نشط" للحفاظ على السجل)`)) return;
    try {
      const res = await adminFetch(`/api/admin/partners/${p.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحذف', 'error'); return; }
      addToast('تم الحذف', 'success');
      load();
    } catch { addToast('فشل الحذف', 'error'); }
  };

  if (forbidden) return <ForbiddenState requiredPerm="partners.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-emerald-700 via-teal-700 to-[#1a1a2e] rounded-2xl p-4 sm:p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">🤝 الشركاء والمستثمرون</h1>
            <p className="text-white/85 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              المساهمون في رأس مال الشركة. كل شريك يملك نسبة ثابتة من قيمة الشركة، وتُحسب حصته من القيمة المعتمدة في تقرير التقييم.
            </p>
          </div>
          <button onClick={openAdd} className="px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition shrink-0">
            + إضافة شريك
          </button>
        </div>
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            <Stat label="عدد الشركاء" value={fmt(summary.activeCount)} sub={`من إجمالي ${fmt(summary.totalCount)}`} />
            <Stat label="مجموع الحصص" value={`${summary.totalStakePercentage.toFixed(2)}%`} highlight={summary.isOverCommitted} sub={summary.isOverCommitted ? '⚠️ تجاوز 100%' : undefined} />
            <Stat label="حصة الشركة المتبقية" value={`${summary.remainingCompanyShare.toFixed(2)}%`} sub="غير موزَّعة على شركاء" />
            <Stat label="رأس المال المساهم" value={fmtMoney(summary.totalCapitalContribution)} />
          </div>
        )}
      </div>

      {summary?.isOverCommitted && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3 text-xs text-red-900 leading-relaxed">
          ⚠️ <strong>تنبيه:</strong> مجموع نسب الشركاء النشطين تجاوز 100% — راجع البيانات لأن هذا غير منطقي اقتصادياً.
        </div>
      )}

      {/* Cap-table visualization */}
      {activePartners.length > 0 && summary && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="text-sm font-black text-gray-900 mb-3">📊 جدول الحصص (Cap Table)</h2>
          <div className="space-y-1.5">
            {activePartners.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-700 w-32 sm:w-40 shrink-0 truncate">{p.name}</span>
                <div className="flex-1 bg-gray-100 rounded h-7 relative overflow-hidden" dir="ltr">
                  <div
                    className={`h-full ${TYPE_COLOR[p.type] ?? 'bg-gray-600'}`}
                    style={{ width: `${Math.min(100, p.stakePercentage)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[11px] font-black text-white mix-blend-difference">
                    {p.stakePercentage}%
                  </span>
                </div>
              </div>
            ))}
            {summary.remainingCompanyShare > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-2">
                <span className="text-xs text-gray-500 w-32 sm:w-40 shrink-0">حصة الشركة (غير موزَّعة)</span>
                <div className="flex-1 bg-gray-100 rounded h-7 relative overflow-hidden" dir="ltr">
                  <div className="h-full bg-gray-300" style={{ width: `${summary.remainingCompanyShare}%` }} />
                  <span className="absolute inset-0 flex items-center px-2 text-[11px] font-black text-gray-700">
                    {summary.remainingCompanyShare.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {([
          { k: 'active', label: 'نشطون' },
          { k: 'all', label: 'الكل' },
          { k: 'inactive', label: 'خرجوا' },
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === f.k ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="مفيش شركاء — اضغط '+ إضافة شريك' للبدء" icon="🤝" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(p => {
            const tone = TYPE_TONE[p.type] ?? 'bg-gray-100 text-gray-700';
            return (
              <div key={p.id} className={`bg-white border rounded-2xl p-4 ${p.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">انضم: {fmtDate(p.joinDate)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tone} shrink-0`}>{TYPE_LABEL[p.type] ?? p.type}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                  <div>
                    <p className="text-gray-500">الحصة</p>
                    <p className="font-black text-gray-900 text-base">{p.stakePercentage}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">رأس مال مساهم</p>
                    <p className="font-bold text-gray-700">{fmtMoney(p.capitalContribution)}</p>
                  </div>
                </div>

                {p.exitDate && (
                  <p className="text-[10px] text-gray-500 mt-2 font-bold">
                    خرج: {fmtDate(p.exitDate)}
                  </p>
                )}

                {(p.contactPhone || p.contactEmail) && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500 space-y-0.5">
                    {p.contactPhone && <p dir="ltr">📞 {p.contactPhone}</p>}
                    {p.contactEmail && <p dir="ltr">📧 {p.contactEmail}</p>}
                  </div>
                )}

                {p.notes && <p className="text-[10px] text-gray-500 mt-2 leading-relaxed border-t border-gray-100 pt-2">{p.notes}</p>}

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(p)} className="flex-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition">✏️ تعديل</button>
                  <button onClick={() => remove(p)} className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold transition">🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-500 text-center">
        💡 حصة كل شريك من القيمة الفعلية للشركة في{' '}
        <Link href="/admin/valuation" className="text-blue-700 hover:underline">تقييم الشركة</Link>
      </p>

      {form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-black text-gray-900">{form.id ? 'تعديل شريك' : 'إضافة شريك'}</h2>
                <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="الاسم *">
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="النوع *">
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="founder">مؤسس</option>
                    <option value="investor">مستثمر</option>
                    <option value="silent-partner">شريك صامت</option>
                    <option value="other">أخرى</option>
                  </select>
                </Field>
                <Field label="نسبة الحصة % *">
                  <input type="number" min="0" max="100" step="0.01" value={form.stakePercentage} onChange={e => setForm({ ...form, stakePercentage: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="رأس مال مساهم (ج.م)">
                  <input type="number" min="0" step="0.01" value={form.capitalContribution} onChange={e => setForm({ ...form, capitalContribution: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="تاريخ الانضمام *">
                  <input type="date" value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
                </Field>
                <Field label="تاريخ الخروج (اختياري)">
                  <input type="date" value={form.exitDate} onChange={e => setForm({ ...form, exitDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
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
                نشط (يحتسب في جدول الحصص)
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
      <p className={`text-lg sm:text-xl font-black mt-1 ${highlight ? 'text-red-300' : 'text-white'}`}>{value}</p>
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
