'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Agreement {
  id: string;
  payeeName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  percentage: number;
  productIds: string[];
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  lastPaidAt: string | null;
  notes: string | null;
  ttmGrossProfit: number;
  amountAccrued: number;
  productNames: Array<{ id: string; name: string }>;
}

interface Summary {
  agreementsTotal: number;
  agreementsActive: number;
  totalAccrued: number;
  avgPercentage: number;
  totalGrossProfitEligible: number;
}

interface ProductOpt { id: string; name: string }

interface FormState {
  id?: string;
  payeeName: string;
  contactPhone: string;
  contactEmail: string;
  percentage: string;
  productIds: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => `${fmt(n)} ج.م`;
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB') : '—';

const blankForm = (): FormState => ({
  payeeName: '', contactPhone: '', contactEmail: '',
  percentage: '', productIds: [],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '', isActive: true, notes: '',
});

export default function IPPage() {
  const { addToast } = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all' | 'inactive'>('active');
  const [productSearch, setProductSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r1 = await adminFetch('/api/admin/ip');
      if (!r1.ok) throw new Error('failed');
      const d1 = await r1.json();
      setAgreements(d1.agreements);
      setSummary(d1.summary);
      try {
        const r2 = await adminFetch('/api/admin/products');
        if (r2.ok) {
          const d2 = await r2.json();
          const list: ProductOpt[] = (d2.products || d2 || [])
            .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
          setProducts(list);
        }
      } catch {
        // staff may not have products.read — picker stays empty
      }
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return agreements;
    if (filter === 'active') return agreements.filter(a => a.isActive);
    return agreements.filter(a => !a.isActive);
  }, [agreements, filter]);

  const productOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const openAdd = () => { setProductSearch(''); setForm(blankForm()); };
  const openEdit = (a: Agreement) => {
    setProductSearch('');
    setForm({
      id: a.id,
      payeeName: a.payeeName,
      contactPhone: a.contactPhone ?? '',
      contactEmail: a.contactEmail ?? '',
      percentage: String(a.percentage),
      productIds: [...a.productIds],
      startDate: a.startDate.slice(0, 10),
      endDate: a.endDate ? a.endDate.slice(0, 10) : '',
      isActive: a.isActive,
      notes: a.notes ?? '',
    });
  };

  const toggleProduct = (id: string) => {
    if (!form) return;
    const has = form.productIds.includes(id);
    setForm({
      ...form,
      productIds: has ? form.productIds.filter(x => x !== id) : [...form.productIds, id],
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.payeeName.trim()) { addToast('اسم المستحق مطلوب', 'warning'); return; }
    const pct = Number(form.percentage);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      addToast('النسبة بين 0 و 100', 'warning'); return;
    }
    if (form.productIds.length === 0) {
      addToast('اختر منتج واحد على الأقل', 'warning'); return;
    }
    setSaving(true);
    try {
      const url = form.id ? `/api/admin/ip/${form.id}` : '/api/admin/ip';
      const method = form.id ? 'PATCH' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payeeName: form.payeeName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          percentage: pct,
          productIds: form.productIds,
          startDate: form.startDate,
          endDate: form.endDate || null,
          isActive: form.isActive,
          notes: form.notes,
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

  const remove = async (a: Agreement) => {
    if (!confirm(`حذف اتفاقية ${a.payeeName}؟`)) return;
    try {
      const res = await adminFetch(`/api/admin/ip/${a.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحذف', 'error'); return; }
      addToast('تم الحذف', 'success');
      load();
    } catch { addToast('فشل الحذف', 'error'); }
  };

  const markPaid = async (a: Agreement) => {
    if (!confirm(`تأكيد دفع المستحقات لـ ${a.payeeName}؟ (سيتم تسجيل تاريخ الدفع كاليوم)`)) return;
    try {
      const res = await adminFetch(`/api/admin/ip/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markPaidNow: true }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل التحديث', 'error'); return; }
      addToast('تم تسجيل الدفع', 'success');
      load();
    } catch { addToast('فشل التحديث', 'error'); }
  };

  if (forbidden) return <ForbiddenState requiredPerm="ip.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-amber-700 via-orange-700 to-[#1a1a2e] rounded-2xl p-4 sm:p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">📚 الملكية الفكرية</h1>
            <p className="text-white/85 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              اتفاقيات المؤلفين وأصحاب الحقوق الذين يستحقون نسبة من الربح الإجمالي على منتجات بعينها لمدة محدَّدة.
              المبالغ المستحقة محسوبة تلقائياً من مبيعات آخر 12 شهر.
            </p>
            <p className="text-[#F5C518]/90 text-[11px] mt-2 max-w-2xl">
              💡 المبالغ هنا تُخصم من القيمة الأساسية للشركة كالتزام قائم في تقرير التقييم. اضغط <strong>"تم الدفع"</strong> بعد تحويل الدفعة الفعلية.
            </p>
          </div>
          <button onClick={openAdd} className="px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] text-xs font-black transition shrink-0">
            + إضافة اتفاقية
          </button>
        </div>
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            <Stat label="اتفاقيات نشطة" value={fmt(summary.agreementsActive)} sub={`من إجمالي ${fmt(summary.agreementsTotal)}`} />
            <Stat label="إجمالي مستحق" value={fmtMoney(summary.totalAccrued)} highlight sub="ربح آخر 12 شهر × النسبة" />
            <Stat label="متوسط النسبة" value={`${summary.avgPercentage.toFixed(2)}%`} />
            <Stat label="ربح خاضع للنسب" value={fmtMoney(summary.totalGrossProfitEligible)} sub="مبيعات المنتجات المرتبطة" />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {([
          { k: 'active', label: 'نشطة' },
          { k: 'all', label: 'الكل' },
          { k: 'inactive', label: 'منتهية' },
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === f.k ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="مفيش اتفاقيات — اضغط '+ إضافة اتفاقية' للبدء" icon="📚" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(a => (
            <div key={a.id} className={`bg-white border rounded-2xl p-4 ${a.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{a.payeeName}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {fmtDate(a.startDate)} → {a.endDate ? fmtDate(a.endDate) : '—'}
                  </p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                  {a.percentage}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                <div>
                  <p className="text-gray-500">مستحق الدفع (TTM)</p>
                  <p className="font-black text-amber-700 text-base">{fmtMoney(a.amountAccrued)}</p>
                </div>
                <div>
                  <p className="text-gray-500">ربح خاضع</p>
                  <p className="font-bold text-gray-700">{fmtMoney(a.ttmGrossProfit)}</p>
                </div>
              </div>

              {a.productNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.productNames.map(p => (
                    <span key={p.id} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {p.name}
                    </span>
                  ))}
                </div>
              )}

              {a.lastPaidAt && (
                <p className="text-[10px] text-emerald-700 mt-2 font-bold">
                  ✅ آخر دفعة: {fmtDate(a.lastPaidAt)}
                </p>
              )}

              {(a.contactPhone || a.contactEmail) && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500 space-y-0.5">
                  {a.contactPhone && <p dir="ltr">📞 {a.contactPhone}</p>}
                  {a.contactEmail && <p dir="ltr">📧 {a.contactEmail}</p>}
                </div>
              )}

              {a.notes && <p className="text-[10px] text-gray-500 mt-2 leading-relaxed border-t border-gray-100 pt-2">{a.notes}</p>}

              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                {a.isActive && a.amountAccrued > 0 && (
                  <button onClick={() => markPaid(a)} className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition">
                    💵 تم الدفع
                  </button>
                )}
                <button onClick={() => openEdit(a)} className="flex-1 px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition">✏️ تعديل</button>
                <button onClick={() => remove(a)} className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold transition">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-500 text-center">
        💡 إجمالي المستحقات يدخل كالتزام قصير المدى في{' '}
        <Link href="/admin/valuation" className="text-blue-700 hover:underline">تقييم الشركة</Link>
      </p>

      {form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-black text-gray-900">{form.id ? 'تعديل اتفاقية' : 'إضافة اتفاقية ملكية فكرية'}</h2>
                <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="اسم المستحق *">
                  <input value={form.payeeName} onChange={e => setForm({ ...form, payeeName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="النسبة % *">
                  <input type="number" min="0" max="100" step="0.01" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
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

              <Field label={`المنتجات المرتبطة (${form.productIds.length} مختار) *`}>
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="🔍 ابحث عن منتج..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
                  {productOptions.length === 0 && (
                    <p className="text-[11px] text-gray-500 text-center py-3">لا منتجات مطابقة</p>
                  )}
                  {productOptions.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-[11px] bg-white px-2 py-1.5 rounded cursor-pointer hover:bg-amber-50">
                      <input
                        type="checkbox"
                        checked={form.productIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-800">{p.name}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="ملاحظات">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </Field>

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                نشطة (تُحتسب في المستحقات)
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
