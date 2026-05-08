'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

type ValuationMethod = 'retail' | 'wholesale' | 'avg-actual' | 'manual';

interface SnapshotSummary {
  id: string;
  hijriYear: string;
  hijriDateLabel: string;
  gregorianDate: string;
  inventoryValuationMethod: string;
  inventoryValueUsed: number;
  cashOnHand: number;
  receivables: number;
  liabilities: number;
  zakatPool: number;
  zakatAmount: number;
  paymentStatus: string;
  paymentDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface Computation {
  inventoryValueRetail: number;
  inventoryValueWholesale: number;
  inventoryValueAvgActual: number;
  inventoryValueManual: number | null;
  inventoryValueUsed: number;
  cashOnHand: number;
  receivables: number;
  liabilities: number;
  zakatPool: number;
  zakatAmount: number;
  comparison: Array<{ method: ValuationMethod; inventory: number; pool: number; zakat: number }>;
  items: Array<{ productId: string; productName: string; quantity: number; unitValue: number; totalValue: number }>;
}

interface TodayInfo {
  hijri: { year: number; month: number; day: number; label: string };
  daysUntilDhulHijjah1: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => `${fmt(n)} ج.م`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB');

const METHOD_LABELS: Record<ValuationMethod, string> = {
  'retail': 'سعر التجزئة',
  'wholesale': 'سعر الجملة',
  'avg-actual': 'متوسط البيع الفعلي',
  'manual': 'تقييم يدوي',
};

export default function ZakatPage() {
  const { addToast } = useToast();
  const [today, setToday] = useState<TodayInfo | null>(null);
  const [history, setHistory] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [method, setMethod] = useState<ValuationMethod>('avg-actual');
  const [cashOnHand, setCashOnHand] = useState('');
  const [windowDays, setWindowDays] = useState(90);
  const [notes, setNotes] = useState('');
  const [computation, setComputation] = useState<Computation | null>(null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/zakat');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setToday(data.today);
      setHistory(data.snapshots);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const compute = async () => {
    setComputing(true);
    try {
      const res = await adminFetch('/api/admin/zakat/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          cashOnHand: Number(cashOnHand) || 0,
          avgActualWindowDays: windowDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل الحساب', 'error'); setComputing(false); return; }
      setComputation(data);
    } catch {
      addToast('فشل الحساب', 'error');
    }
    setComputing(false);
  };

  const save = async () => {
    if (!computation) { addToast('احسب الزكاة أولاً', 'warning'); return; }
    if (!confirm(`حفظ snapshot لسنة ${today?.hijri.year}؟ بعد الحفظ مينفعش تعدّل الأرقام، بس تقدر تحدّث حالة الدفع.`)) return;
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/zakat/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          cashOnHand: Number(cashOnHand) || 0,
          avgActualWindowDays: windowDays,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل الحفظ', 'error'); setSaving(false); return; }
      addToast('تم حفظ الـ snapshot بنجاح', 'success');
      setComputation(null);
      setNotes('');
      await load();
    } catch {
      addToast('فشل الحفظ', 'error');
    }
    setSaving(false);
  };

  const togglePayment = async (snap: SnapshotSummary) => {
    const newStatus = snap.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      const res = await adminFetch(`/api/admin/zakat/snapshot/${snap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل التحديث', 'error'); return; }
      addToast(newStatus === 'paid' ? 'تم اعتماد الدفع' : 'تم إلغاء الاعتماد', 'success');
      await load();
    } catch {
      addToast('فشل التحديث', 'error');
    }
  };

  const summary = useMemo(() => {
    if (!computation) return null;
    return {
      inventory: computation.inventoryValueUsed,
      pool: computation.zakatPool,
      amount: computation.zakatAmount,
    };
  }, [computation]);

  if (forbidden) return <ForbiddenState requiredPerm="zakat.read" />;
  if (loading) return <Spinner />;

  const currentYearHasSnapshot = today && history.some(h => h.hijriYear === String(today.hijri.year));

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-emerald-700 via-emerald-800 to-[#1a1a2e] rounded-3xl p-6 text-white">
        <h1 className="text-2xl font-black flex items-center gap-2">🌙 حساب زكاة عروض التجارة</h1>
        <p className="text-white/70 text-sm mt-2 max-w-2xl leading-relaxed">
          تُحسب الزكاة سنوياً (افتراضياً 1 ذو الحجة) على المخزون المعد للبيع + النقدية + الديون المرجوّة التحصيل، بعد طرح الالتزامات الحالة. النسبة 2.5%.
        </p>
        {today && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <Stat label="التاريخ الهجري" value={today.hijri.label} />
            <Stat
              label="حتى 1 ذو الحجة"
              value={today.daysUntilDhulHijjah1 === 0 ? 'اليوم 🎯' : `${fmt(today.daysUntilDhulHijjah1)} يوم`}
              highlight={today.daysUntilDhulHijjah1 <= 7}
            />
            <Stat
              label="snapshot السنة الحالية"
              value={currentYearHasSnapshot ? '✅ مَحفوظ' : '⏳ لم يُحفظ بعد'}
              highlight={!currentYearHasSnapshot}
            />
          </div>
        )}
      </div>

      {/* Calculator */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-black text-gray-900">📐 الحاسبة</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">اختر طريقة تقييم المخزون، أدخل النقدية، ثم احسب لمعاينة الأرقام قبل الحفظ.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 font-bold mb-1">طريقة تقييم المخزون</label>
            <select value={method} onChange={e => setMethod(e.target.value as ValuationMethod)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs">
              <option value="retail">سعر التجزئة (الحالي)</option>
              <option value="wholesale">سعر الجملة</option>
              <option value="avg-actual">متوسط البيع الفعلي</option>
              <option value="manual">تقييم يدوي (لاحقاً)</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {method === 'wholesale' && 'لو سعر الجملة غير محدد، يُستخدم 85% من سعر التجزئة كقيمة احتياطية.'}
              {method === 'avg-actual' && 'يحسب متوسط سعر البيع الفعلي عبر OrderItems خلال نافذة معينة.'}
              {method === 'retail' && 'القيمة بسعر البيع الحالي. تقدير مفرط لو أكثر المنتجات تباع بخصم.'}
              {method === 'manual' && 'تقييم يدوي لكل منتج — سيتاح في تحديث لاحق. يستخدم سعر التجزئة كاحتياطي.'}
            </p>
          </div>
          {method === 'avg-actual' && (
            <div>
              <label className="block text-[10px] text-gray-500 font-bold mb-1">نافذة المتوسط (أيام)</label>
              <select value={windowDays} onChange={e => setWindowDays(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs">
                <option value={90}>90 يوم</option>
                <option value={180}>180 يوم</option>
                <option value={365}>سنة كاملة</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] text-gray-500 font-bold mb-1">النقدية وأرصدة البنوك (ج.م)</label>
            <input type="number" min="0" step="0.01" value={cashOnHand} onChange={e => setCashOnHand(e.target.value)} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" dir="ltr" />
            <p className="text-[10px] text-gray-400 mt-1">أدخلها يدوياً — النظام لا يربط بالحسابات البنكية.</p>
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 font-bold mb-1">ملاحظات</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري — مرجع، رقم الإيصال، ملاحظات شيخ مستشار..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={compute} disabled={computing} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition disabled:opacity-50">
            {computing ? '...جاري الحساب' : '🧮 احسب الآن'}
          </button>
          {computation && (
            <button onClick={save} disabled={saving || !!currentYearHasSnapshot} className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-black transition disabled:opacity-50" title={currentYearHasSnapshot ? 'يوجد snapshot لهذه السنة بالفعل' : ''}>
              {saving ? '...جاري الحفظ' : currentYearHasSnapshot ? '⚠️ snapshot السنة موجود' : '💾 حفظ Snapshot سنوي'}
            </button>
          )}
        </div>
      </section>

      {/* Live preview */}
      {summary && computation && (
        <section className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Tile label="قيمة المخزون" value={fmtMoney(summary.inventory)} sub={`بطريقة "${METHOD_LABELS[method]}"`} />
            <Tile label="الوعاء الزكوي" value={fmtMoney(summary.pool)} sub={`= ${fmt(summary.inventory)} + نقدية ${fmt(computation.cashOnHand)} + ذمم ${fmt(computation.receivables)} − التزامات ${fmt(computation.liabilities)}`} />
            <Tile label="قيمة الزكاة (2.5%)" value={fmtMoney(summary.amount)} highlight />
            <Tile label="عدد المنتجات في الـ snapshot" value={fmt(computation.items.length)} />
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase">
                <tr>
                  <th className="px-3 py-2 text-right">طريقة التقييم</th>
                  <th className="px-3 py-2 text-right">قيمة المخزون</th>
                  <th className="px-3 py-2 text-right">الوعاء الزكوي</th>
                  <th className="px-3 py-2 text-right">قيمة الزكاة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {computation.comparison.map(c => {
                  const isChosen = c.method === method;
                  return (
                    <tr key={c.method} className={isChosen ? 'bg-emerald-50' : ''}>
                      <td className="px-3 py-2 font-bold">
                        {METHOD_LABELS[c.method]}
                        {isChosen && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded mr-1">المختارة</span>}
                      </td>
                      <td className="px-3 py-2" dir="ltr">{fmtMoney(c.inventory)}</td>
                      <td className="px-3 py-2" dir="ltr">{fmtMoney(c.pool)}</td>
                      <td className="px-3 py-2 font-black text-emerald-700" dir="ltr">{fmtMoney(c.zakat)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* History */}
      <section className="space-y-2">
        <h2 className="text-base font-black text-gray-900">📚 تقارير السنوات السابقة</h2>
        {history.length === 0 ? (
          <EmptyState message="مفيش snapshots محفوظة بعد" icon="📂" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase">
                <tr>
                  <th className="px-3 py-2 text-right">السنة الهجرية</th>
                  <th className="px-3 py-2 text-right">تاريخ الحساب</th>
                  <th className="px-3 py-2 text-right">طريقة التقييم</th>
                  <th className="px-3 py-2 text-right">الوعاء</th>
                  <th className="px-3 py-2 text-right">الزكاة</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map(s => {
                  const isPaid = s.paymentStatus === 'paid';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-black">{s.hijriYear}<p className="text-[10px] text-gray-500 font-normal">{s.hijriDateLabel}</p></td>
                      <td className="px-3 py-2.5 font-mono text-[10px]" dir="ltr">{fmtDate(s.gregorianDate)}</td>
                      <td className="px-3 py-2.5 text-[11px]">{METHOD_LABELS[s.inventoryValuationMethod as ValuationMethod] ?? s.inventoryValuationMethod}</td>
                      <td className="px-3 py-2.5" dir="ltr">{fmtMoney(s.zakatPool)}</td>
                      <td className="px-3 py-2.5 font-black text-emerald-700" dir="ltr">{fmtMoney(s.zakatAmount)}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => togglePayment(s)}
                          className={`text-[10px] px-2 py-1 rounded font-bold transition ${isPaid ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                        >
                          {isPaid ? `✓ مدفوعة${s.paymentDate ? ` (${fmtDate(s.paymentDate)})` : ''}` : '⏳ غير مدفوعة'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-gray-600 max-w-[200px] truncate" title={s.notes ?? ''}>{s.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
        ⚠️ هذا الحساب تقديري لإدارة زكاة عروض التجارة، ويراعى مراجعة أهل العلم في الحالات الخاصة (تكاليف، عملات، ديون مشكوك في تحصيلها...).
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}>
      <p className="text-[10px] text-white/60 font-bold tracking-widest">{label}</p>
      <p className={`text-xl font-black mt-1 ${highlight ? 'text-[#F5C518]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function Tile({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-xl p-3 ${highlight ? 'border-2 border-emerald-500' : 'border border-emerald-200'}`}>
      <p className="text-[10px] text-emerald-700 font-bold tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${highlight ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}
