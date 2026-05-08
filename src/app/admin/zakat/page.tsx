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
  goldPrice: { pricePerGram24K: number; source: string; enteredAt: string; daysOld: number; isStale: boolean; nisabValue: number } | null;
  nisabValue: number | null;
  zakatDue: boolean;
  comparison: Array<{ method: ValuationMethod; inventory: number; pool: number; zakat: number }>;
  items: Array<{ productId: string; productName: string; quantity: number; unitValue: number; totalValue: number }>;
  inventorySummary: { units: number; valueRetail: number; productsCount: number; inStockProductCount: number };
}

interface GoldPriceState {
  pricePerGram24K: number;
  source: string;
  enteredAt: string;
  daysOld: number;
  isStale: boolean;
  nisabValue: number;
  note?: string;
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

      {/* Gold price + nisab — must be configured first because the
          nisab gates whether Zakat is due at all. */}
      <GoldPriceCard />

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
        <section className={`border-2 rounded-2xl p-5 space-y-4 ${computation.zakatDue ? 'bg-emerald-50 border-emerald-300' : 'bg-blue-50 border-blue-300'}`}>
          {/* Nisab gate banner — shows whether Zakat is obligatory at all */}
          {computation.nisabValue !== null && (
            <div className={`rounded-xl p-3 ${computation.zakatDue ? 'bg-emerald-100 border border-emerald-300' : 'bg-blue-100 border border-blue-300'}`}>
              <p className={`text-sm font-black ${computation.zakatDue ? 'text-emerald-900' : 'text-blue-900'}`}>
                {computation.zakatDue
                  ? `✅ الوعاء (${fmt(summary.pool)}) يتجاوز النصاب (${fmt(computation.nisabValue)}) — تجب الزكاة بنسبة 2.5%`
                  : `ℹ️ الوعاء (${fmt(summary.pool)}) أقل من النصاب (${fmt(computation.nisabValue)}) — لا تجب الزكاة هذا العام`}
              </p>
              {computation.goldPrice && (
                <p className={`text-[11px] mt-1 ${computation.zakatDue ? 'text-emerald-700' : 'text-blue-700'}`}>
                  بناءً على سعر الذهب 24K: {fmt(computation.goldPrice.pricePerGram24K)} ج.م/جرام × 85 جم
                  ({computation.goldPrice.source === 'manual' ? 'يدوي' : computation.goldPrice.source})
                </p>
              )}
            </div>
          )}
          {computation.nisabValue === null && (
            <div className="bg-amber-100 border border-amber-300 rounded-xl p-3">
              <p className="text-sm font-bold text-amber-900">
                ⚠️ سعر الذهب غير محدد — الزكاة هتتحسب بدون فحص النصاب. أدخل سعر الذهب في الكارت أعلاه قبل الحفظ.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Tile label="قيمة المخزون" value={fmtMoney(summary.inventory)} sub={`بطريقة "${METHOD_LABELS[method]}"`} />
            <Tile label="الوعاء الزكوي" value={fmtMoney(summary.pool)} sub={`= ${fmt(summary.inventory)} + نقدية ${fmt(computation.cashOnHand)} + ذمم ${fmt(computation.receivables)} − التزامات ${fmt(computation.liabilities)}`} />
            <Tile
              label={computation.zakatDue ? 'قيمة الزكاة (2.5%)' : 'قيمة الزكاة'}
              value={fmtMoney(summary.amount)}
              highlight={computation.zakatDue}
              sub={!computation.zakatDue ? 'لا تجب — الوعاء تحت النصاب' : undefined}
            />
            <Tile label="عدد المنتجات في الـ snapshot" value={fmt(computation.items.length)} />
          </div>

          {/* Sanity check — same data the inventory page is showing.
              If these two numbers ever disagree, that's a sync bug
              between the pages. */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-[11px] text-gray-700 leading-relaxed">
            🔗 <strong>مرجع من صفحة المخزون</strong> (لازم يطابق):
            <span className="mx-2 text-gray-900 font-bold">{fmt(computation.inventorySummary.valueRetail)} ج.م</span>
            بسعر التجزئة على
            <span className="mx-1 text-gray-900 font-bold">{fmt(computation.inventorySummary.units)}</span>
            قطعة في
            <span className="mx-1 text-gray-900 font-bold">{fmt(computation.inventorySummary.inStockProductCount)}</span>
            من <span className="mx-1 text-gray-900 font-bold">{fmt(computation.inventorySummary.productsCount)}</span> منتج.
            <Link href="/admin/inventory" className="text-blue-700 hover:underline mx-1">افتح المخزون ↗</Link>
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

// ────────────────────────────────────────────────────────────────────
// Gold price card — manual entry (primary) + international suggestion.
// The Egyptian local market carries a premium over international spot,
// so we prioritize what the admin types from شعبة الذهب and treat the
// goldprice.org fetch as a starting suggestion only.
// ────────────────────────────────────────────────────────────────────
function GoldPriceCard() {
  const { addToast } = useToast();
  const [state, setState] = useState<GoldPriceState | null>(null);
  const [suggestion, setSuggestion] = useState<{ pricePerGram24K: number; source: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false);

  const load = async (withSuggestion = false) => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/zakat/gold-price${withSuggestion ? '?suggest=1' : ''}`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setState(data.state);
      if (data.suggestion) setSuggestion(data.suggestion);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fetchSuggestion = async () => {
    setFetchingSuggestion(true);
    await load(true);
    setFetchingSuggestion(false);
    if (!suggestion) {
      // load() refreshed `suggestion` in state; if still null, the
      // upstream failed.
      addToast('فشل الجلب من goldprice.org — أدخل السعر يدوياً', 'warning');
    }
  };

  const save = async () => {
    const price = Number(draft);
    if (!Number.isFinite(price) || price <= 0) { addToast('السعر غير صحيح', 'warning'); return; }
    try {
      const res = await adminFetch('/api/admin/zakat/gold-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricePerGram24K: price, note: draftNote }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); return; }
      addToast('تم حفظ سعر الذهب', 'success');
      setEditing(false);
      setDraft('');
      setDraftNote('');
      load();
    } catch {
      addToast('فشل الحفظ', 'error');
    }
  };

  if (loading) return null;

  return (
    <section className={`rounded-2xl p-5 space-y-3 ${state?.isStale ? 'bg-amber-50 border-2 border-amber-300' : 'bg-yellow-50 border-2 border-yellow-300'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">🟡 سعر الذهب 24 (السوق المحلي)</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">السعر اللي بناءً عليه يُحسب نصاب الزكاة (85 جرام × سعر الجرام).</p>
        </div>
        <button
          onClick={() => { setEditing(v => !v); if (!editing && state) setDraft(String(state.pricePerGram24K)); }}
          className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-[11px] font-bold transition"
        >
          {editing ? '✕ إلغاء' : state ? '✏️ تحديث السعر' : '+ إدخال السعر'}
        </button>
      </div>

      {state ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-yellow-200 p-3">
            <p className="text-[10px] text-gray-500 font-bold tracking-widest">سعر الجرام (24K)</p>
            <p className="text-2xl font-black text-yellow-700 mt-1" dir="ltr">{fmt(state.pricePerGram24K)} ج.م</p>
            <p className="text-[10px] text-gray-400 mt-1">
              المصدر: <strong>{state.source === 'manual' ? 'يدوي (شعبة الذهب)' : state.source}</strong>
              {' · '}
              <span className={state.isStale ? 'text-red-700 font-bold' : ''}>
                من {state.daysOld === 0 ? 'اليوم' : `${state.daysOld} يوم`}
                {state.isStale && ' ⚠️ قديم'}
              </span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-yellow-200 p-3">
            <p className="text-[10px] text-gray-500 font-bold tracking-widest">قيمة النصاب (85 جم)</p>
            <p className="text-2xl font-black text-emerald-700 mt-1" dir="ltr">{fmt(state.nisabValue)} ج.م</p>
            <p className="text-[10px] text-gray-400 mt-1">الحد الأدنى للوعاء الذي تجب فيه الزكاة.</p>
          </div>
          {state.note && (
            <div className="bg-white rounded-xl border border-yellow-200 p-3">
              <p className="text-[10px] text-gray-500 font-bold tracking-widest">ملاحظة</p>
              <p className="text-[11px] text-gray-700 mt-1 leading-relaxed">{state.note}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-yellow-300 rounded-xl p-3 text-[11px] text-amber-900">
          لم يتم إدخال سعر الذهب بعد. الزكاة هتتحسب بدون فحص النصاب — اضغط <strong>إدخال السعر</strong>.
        </div>
      )}

      {state?.isStale && !editing && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-[11px] text-red-900">
          ⚠️ السعر المحفوظ عمره {state.daysOld} يوم. أسعار الذهب بتتغير يومياً — حدّث السعر قبل حفظ snapshot.
        </div>
      )}

      {editing && (
        <div className="bg-white rounded-xl border border-yellow-300 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 font-bold mb-1">سعر الجرام 24K (ج.م)</label>
              <input
                type="number" min="0" step="0.01"
                value={draft} onChange={e => setDraft(e.target.value)}
                placeholder="مثال: 4500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] text-gray-500 font-bold mb-1">ملاحظة / مصدر السعر</label>
              <input
                value={draftNote} onChange={e => setDraftNote(e.target.value)}
                placeholder="مثال: شعبة الذهب — 26/05/2026"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* International spot fetch as a starting suggestion */}
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] font-bold text-amber-900">💡 سعر دولي (نقطة بداية فقط)</p>
                <p className="text-[10px] text-amber-800 mt-0.5">
                  السوق المحلي المصري عادة أعلى من الدولي بنسبة 5–15%. استخدم السعر المحلي اللي بتأكدت منه.
                </p>
              </div>
              <button
                onClick={fetchSuggestion}
                disabled={fetchingSuggestion}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition disabled:opacity-50"
              >
                {fetchingSuggestion ? '...جاري الجلب' : '🌍 جلب السعر الدولي'}
              </button>
            </div>
            {suggestion && (
              <div className="mt-2 flex items-center justify-between gap-2 bg-white rounded-lg p-2">
                <p className="text-xs text-gray-700">
                  <strong dir="ltr">{fmt(suggestion.pricePerGram24K)} ج.م/جرام</strong>
                  <span className="text-[10px] text-gray-400 mx-1">من {suggestion.source}</span>
                </p>
                <button
                  onClick={() => setDraft(String(suggestion.pricePerGram24K))}
                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold"
                >
                  استخدم كقاعدة
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={save} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition">💾 حفظ السعر</button>
          </div>

          <p className="text-[10px] text-gray-500 leading-relaxed">
            🔗 المصادر المصرية الموثوقة لأسعار الذهب:
            {' '}<a href="https://isgold.eg" target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">شعبة الذهب المصرية</a>،
            {' '}<a href="https://www.cibeg.com" target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">البنك التجاري الدولي</a>،
            {' '}<a href="https://www.gold-price.net/en/egypt" target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">gold-price.net/Egypt</a>.
          </p>
        </div>
      )}
    </section>
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
