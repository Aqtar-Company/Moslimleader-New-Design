'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Row {
  productId: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  variantIndex: number | null;
  variantName: string | null;
  currentStock: number;
  batchedQuantity: number;
  uncoveredQuantity: number;
  alreadySeeded: boolean;
  suggestedUnitCost: number;
}

interface DraftEntry {
  unitCost: string; // input as string so the user can clear / edit freely
  skip: boolean;
}

const fmt = (n: number) => n.toLocaleString('ar-EG');
const round2 = (n: number) => Math.round(n * 100) / 100;

const rowKey = (r: Row) => `${r.productId}::${r.variantIndex === null ? '_' : r.variantIndex}`;

export default function SeedStockWizard() {
  const router = useRouter();
  const { addToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [batchDate, setBatchDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/production/seed-stock');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const fetched: Row[] = data.rows;
        setRows(fetched);
        // Pre-fill each draft with the suggested heuristic. Already-seeded rows
        // start skipped (the wizard is mostly for first-pass entry; adding a
        // second seed is allowed but not the default action).
        const initial: Record<string, DraftEntry> = {};
        for (const r of fetched) {
          initial[rowKey(r)] = {
            unitCost: String(r.suggestedUnitCost || ''),
            skip: r.alreadySeeded || r.uncoveredQuantity === 0,
          };
        }
        setDrafts(initial);
      } catch (err) {
        if (err instanceof ForbiddenError) setForbidden(true);
        else addToast('فشل التحميل', 'error');
      }
      setLoading(false);
    })();
  }, [addToast]);

  const updateDraft = (k: string, patch: Partial<DraftEntry>) => {
    setDrafts(prev => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  };

  // Computed summary at submit time — keeps the footer accurate while the
  // user toggles rows on and off.
  const summary = useMemo(() => {
    let count = 0; let totalCost = 0;
    for (const r of rows) {
      const d = drafts[rowKey(r)];
      if (!d || d.skip || r.uncoveredQuantity === 0) continue;
      const cost = Number(d.unitCost);
      if (!Number.isFinite(cost) || cost < 0) continue;
      count++;
      totalCost += r.uncoveredQuantity * cost;
    }
    return { count, totalCost: round2(totalCost) };
  }, [rows, drafts]);

  const submit = async () => {
    if (submitting) return;
    if (summary.count === 0) { addToast('اختر سطر واحد على الأقل', 'warning'); return; }
    setSubmitting(true);

    const entries = rows.flatMap(r => {
      const d = drafts[rowKey(r)];
      if (!d || d.skip || r.uncoveredQuantity === 0) return [];
      const cost = Number(d.unitCost);
      if (!Number.isFinite(cost) || cost < 0) return [];
      return [{
        productId: r.productId,
        variantIndex: r.variantIndex,
        quantity: r.uncoveredQuantity,
        unitCost: cost,
      }];
    });

    try {
      const res = await adminFetch('/api/admin/production/seed-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, batchDate }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); setSubmitting(false); return; }
      const msg = d.skipped > 0
        ? `تم تسعير ${d.created} منتج (${d.skipped} تم تخطيه — راجع التفاصيل)`
        : `تم تسعير ${d.created} منتج بنجاح`;
      addToast(msg, d.skipped > 0 ? 'warning' : 'success', 6000);
      // Bounce to the valuation page so the user immediately sees the impact.
      router.push('/admin/valuation');
    } catch {
      addToast('فشل الحفظ', 'error');
      setSubmitting(false);
    }
  };

  if (forbidden) return <ForbiddenState requiredPerm="production.write" />;
  if (loading) return <Spinner />;

  const seededCount = rows.filter(r => r.alreadySeeded).length;
  const fullyCoveredCount = rows.filter(r => r.uncoveredQuantity === 0).length;
  const needsSeedingCount = rows.length - seededCount - fullyCoveredCount;

  return (
    <div className="space-y-5" dir="rtl">
      <Link href="/admin/production" className="text-xs text-gray-500 hover:text-gray-900">← العودة لباتشات الإنتاج</Link>

      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl p-6 text-white">
        <h1 className="text-xl font-black flex items-center gap-2">🌱 تسعير المخزون الافتتاحي</h1>
        <p className="text-white/70 text-sm mt-2 max-w-2xl leading-relaxed">
          المخزون اللي كان موجود قبل ما تبدأ تسجل باتشات إنتاج محتاج تكلفة وحدة. الصفحة دي بتعمل باتش افتتاحي لكل منتج محتاج تسعير
          — <strong className="text-[#F5C518]">من غير ما يزود المخزون</strong> ومن غير ما يعمل قيد على أي مورد.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <Stat label="إجمالي السطور" value={String(rows.length)} />
          <Stat label="محتاج تسعير" value={String(needsSeedingCount)} highlight />
          <Stat label="تم تسعيره" value={String(seededCount)} />
          <Stat label="مغطّى بالكامل" value={String(fullyCoveredCount)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="مفيش منتجات في المخزون حالياً" icon="🌱" />
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
            <label className="text-xs text-gray-700 font-bold">تاريخ الباتش الافتتاحي:</label>
            <input
              type="date"
              value={batchDate}
              onChange={e => setBatchDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              dir="ltr"
            />
            <span className="text-[10px] text-gray-500">يُطبق على كل السطور المُحدّدة. الافتراضي: قبل سنة من اليوم.</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-3 text-right">المنتج</th>
                    <th className="px-3 py-3 text-right">الموديل</th>
                    <th className="px-3 py-3 text-right">المخزون</th>
                    <th className="px-3 py-3 text-right">مغطّى ببتشات</th>
                    <th className="px-3 py-3 text-right">يحتاج تسعير</th>
                    <th className="px-3 py-3 text-right">تكلفة الوحدة</th>
                    <th className="px-3 py-3 text-right">الإجمالي</th>
                    <th className="px-3 py-3 text-right">تخطّي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => {
                    const k = rowKey(r);
                    const d = drafts[k] ?? { unitCost: '', skip: false };
                    const cost = Number(d.unitCost);
                    const lineTotal = Number.isFinite(cost) && cost >= 0 ? round2(r.uncoveredQuantity * cost) : 0;
                    const isFullyCovered = r.uncoveredQuantity === 0;
                    const inputDisabled = d.skip || isFullyCovered;

                    return (
                      <tr key={k} className={inputDisabled ? 'bg-gray-50/50' : ''}>
                        <td className="px-3 py-2.5 font-bold text-gray-900">
                          {r.productName}
                          {r.alreadySeeded && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">🔒 مسعَّر سابقاً</span>}
                          {isFullyCovered && !r.alreadySeeded && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">✓ مغطّى بالكامل</span>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{r.variantName || '—'}</td>
                        <td className="px-3 py-2.5 font-bold">{fmt(r.currentStock)}</td>
                        <td className="px-3 py-2.5 text-gray-600">{fmt(r.batchedQuantity)}</td>
                        <td className="px-3 py-2.5 font-black text-blue-700">{fmt(r.uncoveredQuantity)}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={d.unitCost}
                            onChange={e => updateDraft(k, { unitCost: e.target.value })}
                            disabled={inputDisabled}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F5C518] disabled:bg-gray-100 disabled:text-gray-400"
                            dir="ltr"
                          />
                          <span className="text-[10px] text-gray-400 mr-1">ج.م</span>
                        </td>
                        <td className="px-3 py-2.5 font-black text-[#6B21A8]">
                          {inputDisabled ? '—' : `${fmt(lineTotal)} ج.م`}
                        </td>
                        <td className="px-3 py-2.5">
                          {!isFullyCovered && (
                            <input
                              type="checkbox"
                              checked={d.skip}
                              onChange={e => updateDraft(k, { skip: e.target.checked })}
                              className="w-4 h-4"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border-2 border-[#F5C518] rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-black text-[#1a1a2e]">
                هتسجّل افتتاحية لـ <span className="text-amber-700">{summary.count}</span> منتج
              </p>
              <p className="text-xs text-amber-900 mt-1">إجمالي تكلفة الافتتاحيات: <strong>{fmt(summary.totalCost)} ج.م</strong></p>
              <p className="text-[10px] text-amber-700 mt-1">⚠️ لن يتم تعديل المخزون أو رصيد الموردين. هذا تسعير فقط.</p>
            </div>
            <button
              onClick={submit}
              disabled={submitting || summary.count === 0}
              className="px-5 py-2.5 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-sm font-black transition disabled:opacity-50"
            >
              {submitting ? '...جاري الحفظ' : '🌱 حفظ الافتتاحيات'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white/10 backdrop-blur border border-white/15 rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,.08)' }}>
      <p className="text-[10px] text-white/60 font-bold tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${highlight ? 'text-[#F5C518]' : 'text-white'}`}>{value}</p>
    </div>
  );
}
