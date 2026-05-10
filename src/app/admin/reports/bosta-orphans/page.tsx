'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface SuggestedItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  unitPrice: number;
  matchScore: number;
  parsedName: string;
}

interface OrphanRow {
  orderId: string;
  createdAt: string;
  customerName: string | null;
  trackingNumber: string | null;
  cod: number;
  orderTotal: number;
  description: string | null;
  parsedItems: Array<{ name: string; quantity: number }>;
  suggestedItems: SuggestedItem[];
  suggestedSum: number;
  paymentNote: string;
  confidence: number;
  priceDriftPct: number | null;
}

interface BulkSampleMatch {
  orderId: string;
  customerName: string | null;
  confidence: number;
  priceDriftPct: number | null;
  suggestedSum: number;
  orderTotal: number;
  cod: number;
  items: Array<{ productName: string; quantity: number; unitPrice: number; matchScore: number; parsedName: string }>;
}

interface BatchSummary {
  batchId: string;
  createdAt: string;
  actorName: string | null;
  matchedCount: number;
  errorCount: number;
  minConfidence: number;
}

interface Product { id: string; name: string; price: number }

interface DraftItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface Draft {
  items: DraftItem[];
  skip: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => `${fmt(n)} ج.م`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB');

export default function BostaOrphansPage() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<OrphanRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalOrphan, setTotalOrphan] = useState(0);
  const [highConfidenceCount, setHighConfidenceCount] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  // Bulk-match state
  const [bulkMinConfidence, setBulkMinConfidence] = useState(0.5);
  const [bulkPreview, setBulkPreview] = useState<{
    wouldMatch: number;
    wouldSkip: number;
    sampleMatches: BulkSampleMatch[];
    diagnostics?: {
      noDescription: number;
      noParsedItems: number;
      noMatchedItems: number;
      belowThreshold: number;
      confidenceBuckets: Record<string, number>;
    };
  } | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [batches, setBatches] = useState<BatchSummary[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [orphRes, prodRes] = await Promise.all([
        adminFetch('/api/admin/reports/bosta-orphans?limit=200'),
        adminFetch('/api/admin/products?lite=true'),
      ]);
      if (!orphRes.ok) throw new Error('failed');
      const data = await orphRes.json();
      setRows(data.rows);
      setTotalOrphan(data.totalOrphanCount);
      setHighConfidenceCount(data.highConfidenceCount);
      const initial: Record<string, Draft> = {};
      for (const r of data.rows as OrphanRow[]) {
        initial[r.orderId] = {
          // Pre-fill with the suggested multi-item bundle. Empty if
          // parsing failed — admin starts blank.
          items: r.suggestedItems.map(s => ({
            productId: s.productId,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
          })),
          skip: false,
        };
      }
      setDrafts(initial);
      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData.products || []);
      }
      // Fetch recent bulk-match batches so the undo button can target
      // the most recent one without making the user remember the ID.
      try {
        const batchRes = await adminFetch('/api/admin/reports/bosta-orphans/bulk-undo');
        if (batchRes.ok) {
          const bData = await batchRes.json();
          setBatches(bData.batches ?? []);
        }
      } catch { /* non-fatal */ }
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Per-row item helpers — each row's draft is an array of items the
  // admin can grow (Add) or shrink (Remove).
  const addItem = (orderId: string) => {
    setDrafts(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], items: [...prev[orderId].items, { productId: '', quantity: 1, unitPrice: 0 }] },
    }));
  };
  const removeItem = (orderId: string, idx: number) => {
    setDrafts(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], items: prev[orderId].items.filter((_, i) => i !== idx) },
    }));
  };
  const updateItem = (orderId: string, idx: number, patch: Partial<DraftItem>) => {
    setDrafts(prev => {
      const items = prev[orderId].items.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        // Auto-fill unitPrice from current Product.price when a product
        // is selected (admin can override afterwards for old prices).
        if (patch.productId !== undefined && patch.productId !== it.productId) {
          const p = productById.get(patch.productId);
          if (p) next.unitPrice = p.price;
        }
        return next;
      });
      return { ...prev, [orderId]: { ...prev[orderId], items } };
    });
  };
  const setSkip = (orderId: string, skip: boolean) => {
    setDrafts(prev => ({ ...prev, [orderId]: { ...prev[orderId], skip } }));
  };
  // For old-price reconciliation: rescale all item prices proportionally
  // so they sum to the recorded order total. Useful when current prices
  // changed since the order shipped.
  const rescaleToOrderTotal = (orderId: string, target: number) => {
    setDrafts(prev => {
      const d = prev[orderId];
      if (!d || target <= 0) return prev;
      const sum = d.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      if (sum <= 0) return prev;
      const factor = target / sum;
      const items = d.items.map(it => ({ ...it, unitPrice: Math.round(it.unitPrice * factor * 100) / 100 }));
      return { ...prev, [orderId]: { ...d, items } };
    });
  };

  const summary = useMemo(() => {
    let count = 0;
    let units = 0;
    for (const r of rows) {
      const d = drafts[r.orderId];
      if (!d || d.skip || d.items.length === 0) continue;
      // Skip rows where any item is incomplete (no product selected).
      const valid = d.items.filter(it => it.productId && it.quantity > 0);
      if (valid.length === 0) continue;
      count++;
      units += valid.reduce((s, it) => s + it.quantity, 0);
    }
    return { count, units };
  }, [rows, drafts]);

  const submit = async () => {
    if (submitting) return;
    if (summary.count === 0) { addToast('اختر منتجات لطلب واحد على الأقل', 'warning'); return; }
    setSubmitting(true);
    const entries = rows.flatMap(r => {
      const d = drafts[r.orderId];
      if (!d || d.skip || d.items.length === 0) return [];
      const items = d.items.filter(it => it.productId && it.quantity > 0);
      if (items.length === 0) return [];
      return [{ orderId: r.orderId, items }];
    });
    try {
      const res = await adminFetch('/api/admin/reports/bosta-orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل الحفظ', 'error'); setSubmitting(false); return; }
      addToast(`تم backfill لـ ${data.created} طلب (${data.itemsCreated} عنصر)${data.skipped > 0 ? ` — ${data.skipped} تم تخطيها` : ''}`, 'success', 6000);
      await load();
    } catch {
      addToast('فشل الحفظ', 'error');
    }
    setSubmitting(false);
  };

  const runBulkPreview = async () => {
    setBulkRunning(true);
    try {
      const res = await adminFetch('/api/admin/reports/bosta-orphans/bulk-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minConfidence: bulkMinConfidence, dryRun: true, limit: 500 }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشلت المعاينة', 'error'); setBulkRunning(false); return; }
      setBulkPreview({
        wouldMatch: data.wouldMatch,
        wouldSkip: data.wouldSkip,
        sampleMatches: data.sampleMatches ?? [],
        diagnostics: data.diagnostics,
      });
    } catch {
      addToast('فشلت المعاينة', 'error');
    }
    setBulkRunning(false);
  };

  const runBulkCommit = async () => {
    if (bulkRunning) return;
    if (!confirm(`هتنفذ مطابقة جماعية لـ ${bulkPreview?.wouldMatch ?? '?'} طلب. متأكد؟`)) return;
    setBulkRunning(true);
    try {
      const res = await adminFetch('/api/admin/reports/bosta-orphans/bulk-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minConfidence: bulkMinConfidence, dryRun: false, limit: 500 }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشلت المطابقة', 'error'); setBulkRunning(false); return; }
      addToast(`اتعمل match لـ ${data.matched} طلب (batch: ${data.batchId})${data.errors?.length ? ` — ${data.errors.length} فشلوا` : ''}`, 'success', 8000);
      setBulkPreview(null);
      await load();
    } catch {
      addToast('فشلت المطابقة', 'error');
    }
    setBulkRunning(false);
  };

  const purgeNonProducts = async (dryRun: boolean) => {
    if (bulkRunning) return;
    if (!dryRun && !confirm('هتمسح كل طلبات الفنون / العمارة / الباكدج (Art Learn Academy) من قاعدة البيانات. ده delete نهائي. متأكد؟')) return;
    setBulkRunning(true);
    try {
      const res = await adminFetch('/api/admin/reports/bosta-orphans/purge-non-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشلت العملية', 'error'); setBulkRunning(false); return; }
      if (data.dryRun) {
        const total = Math.round(data.totalValue ?? 0).toLocaleString('en-US');
        addToast(`معاينة: هيتمسح ${data.wouldDelete} طلب بقيمة ${total} ج.م — لو الرقم سليم اضغط "نفّذ المسح"`, 'success', 8000);
      } else {
        addToast(`اتمسح ${data.deleted} طلب`, 'success', 6000);
        await load();
      }
    } catch {
      addToast('فشلت العملية', 'error');
    }
    setBulkRunning(false);
  };

  const undoBatch = async (batchId: string) => {
    if (!confirm(`هتلغي كل المطابقات في الدفعة ${batchId}؟ ده هيمسح الـ OrderItems اللي اتعملت.`)) return;
    setBulkRunning(true);
    try {
      const res = await adminFetch('/api/admin/reports/bosta-orphans/bulk-undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل التراجع', 'error'); setBulkRunning(false); return; }
      addToast(`اتمسح ${data.itemsDeleted} عنصر من ${data.affectedOrders} طلب`, 'success', 6000);
      await load();
    } catch {
      addToast('فشل التراجع', 'error');
    }
    setBulkRunning(false);
  };

  const confirmHighConfidence = () => {
    let changed = 0;
    for (const r of rows) {
      if (r.confidence >= 0.8 && r.suggestedItems.length > 0) {
        // Already pre-filled on load; just flip skip back off in case
        // the admin had toggled it.
        setDrafts(prev => ({ ...prev, [r.orderId]: { ...prev[r.orderId], skip: false } }));
        changed++;
      }
    }
    if (changed > 0) addToast(`جاهز لتأكيد ${changed} طلب عالي الثقة — اضغط "حفظ"`, 'success');
  };

  if (forbidden) return <ForbiddenState requiredPerm="inventory.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" dir="rtl">
      <Link href="/admin/reports/sales-by-product" className="text-xs text-gray-500 hover:text-gray-900">← العودة لتوزيع المبيعات</Link>

      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl p-6 text-white">
        <h1 className="text-xl font-black flex items-center gap-2">📦 طلبات بوسطة محتاجة منتجات</h1>
        <p className="text-white/70 text-sm mt-2 max-w-2xl leading-relaxed">
          طلبات بوسطة المستوردة من تاريخ الشركة <strong className="text-[#F5C518]">ما عندهاش OrderItems</strong>.
          النظام بيقرأ وصف بوسطة ويستخرج كل المنتجات اللي اتشحنت في كل طلب — تقدر تراجع وتعدل قبل الحفظ.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          <Stat label="إجمالي طلبات بدون منتجات" value={fmt(totalOrphan)} />
          <Stat label="معروضة دلوقتي" value={fmt(rows.length)} sub="آخر 200" />
          <Stat label="ثقة عالية (≥80%)" value={fmt(highConfidenceCount)} highlight />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="مفيش طلبات بوسطة بدون منتجات — كله متعمله backfill" icon="✅" />
      ) : (
        <>
          <div className="bg-gradient-to-l from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-black text-indigo-900">⚡ مطابقة جماعية تلقائية</p>
                <p className="text-[11px] text-indigo-800 mt-1 leading-relaxed">
                  هتطابق كل الطلبات اللي ثقتها ≥ <strong>{Math.round(bulkMinConfidence * 100)}%</strong> دفعة واحدة.
                  بنتسامح مع فرق سعر ±15% (ينخفض الكريديت تدريجياً لـ ±30%) عشان الأسعار التاريخية ورسوم بوسطة.
                  أي مطابقة بتتسجل في audit log وتقدر تتراجع عنها كاملة.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[10px] text-indigo-700 font-bold">حد أدنى للثقة</label>
                <input
                  type="range" min="0.3" max="0.9" step="0.05"
                  value={bulkMinConfidence}
                  onChange={e => { setBulkMinConfidence(Number(e.target.value)); setBulkPreview(null); }}
                  disabled={bulkRunning}
                  className="w-24"
                />
                <span className="text-xs font-mono font-black text-indigo-900 w-10 text-center">{Math.round(bulkMinConfidence * 100)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={runBulkPreview}
                disabled={bulkRunning}
                className="px-4 py-2 rounded-xl bg-white hover:bg-indigo-100 text-indigo-700 text-xs font-black transition disabled:opacity-50 border border-indigo-300"
              >
                {bulkRunning ? '...جاري الفحص' : '👁 معاينة (dry-run)'}
              </button>
              {bulkPreview && bulkPreview.wouldMatch > 0 && (
                <button
                  onClick={runBulkCommit}
                  disabled={bulkRunning}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition disabled:opacity-50"
                >
                  {bulkRunning ? '...جاري التنفيذ' : `⚡ نفّذ على ${fmt(bulkPreview.wouldMatch)} طلب`}
                </button>
              )}
              {batches.length > 0 && (
                <button
                  onClick={() => undoBatch(batches[0].batchId)}
                  disabled={bulkRunning}
                  className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition disabled:opacity-50 border border-amber-300"
                  title={`آخر دفعة: ${batches[0].matchedCount} طلب — ${new Date(batches[0].createdAt).toLocaleString('en-GB')}`}
                >
                  ↩ تراجع عن آخر دفعة ({fmt(batches[0].matchedCount)})
                </button>
              )}
              <span className="w-px h-6 bg-indigo-300 mx-1" />
              <button
                onClick={() => purgeNonProducts(true)}
                disabled={bulkRunning}
                className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition disabled:opacity-50 border border-red-300"
                title="معاينة طلبات Art Learn Academy / فنون / عمارة قبل الحذف"
              >
                👁 معاينة طلبات الفنون
              </button>
              <button
                onClick={() => purgeNonProducts(false)}
                disabled={bulkRunning}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition disabled:opacity-50"
                title="حذف نهائي لكل طلبات الفنون والعمارة من قاعدة البيانات"
              >
                🗑 حذف طلبات الفنون
              </button>
            </div>

            {bulkPreview && (
              <div className="bg-white rounded-xl p-3 border border-indigo-200">
                <p className="text-xs font-bold text-gray-800">
                  المعاينة: <strong className="text-indigo-700">{fmt(bulkPreview.wouldMatch)}</strong> هيتعملهم match،
                  و<strong className="text-gray-500">{fmt(bulkPreview.wouldSkip)}</strong> هيتخطّوا (ثقة أقل).
                </p>
                {bulkPreview.diagnostics && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    <DiagBox label="مفيش وصف" value={bulkPreview.diagnostics.noDescription} tone="gray" />
                    <DiagBox label="وصف بدون parse" value={bulkPreview.diagnostics.noParsedItems} tone="gray" />
                    <DiagBox label="مفيش منتج اتطابق" value={bulkPreview.diagnostics.noMatchedItems} tone="amber" />
                    <DiagBox label="تحت حد الثقة" value={bulkPreview.diagnostics.belowThreshold} tone="amber" />
                    <div className="col-span-2 sm:col-span-4 flex items-center gap-2 text-[10px] text-gray-600">
                      <span className="font-bold">توزيع الثقة:</span>
                      {Object.entries(bulkPreview.diagnostics.confidenceBuckets).map(([k, v]) => (
                        <span key={k} className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {k}%: <strong>{fmt(v)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {bulkPreview.sampleMatches.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[11px] text-indigo-700 cursor-pointer hover:text-indigo-900 font-bold">
                      عيّنة من أول {bulkPreview.sampleMatches.length} مطابقة
                    </summary>
                    <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5">
                      {bulkPreview.sampleMatches.map(s => (
                        <div key={s.orderId} className="text-[10px] bg-gray-50 rounded p-2 border border-gray-200">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold">#{s.orderId.slice(-6).toUpperCase()}</span>
                            <span className="text-gray-600">{s.customerName ?? 'ضيف'}</span>
                            <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              ثقة {Math.round(s.confidence * 100)}%
                            </span>
                            {s.priceDriftPct !== null && (
                              <span className={`px-1.5 py-0.5 rounded font-bold ${Math.abs(s.priceDriftPct) <= 15 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                فرق سعر {s.priceDriftPct > 0 ? '+' : ''}{s.priceDriftPct}%
                              </span>
                            )}
                          </div>
                          <div className="text-gray-700 mt-1">
                            {s.items.map(i => `${i.productName} ×${i.quantity}`).join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {highConfidenceCount > 0 && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-black text-emerald-900">⚡ {fmt(highConfidenceCount)} طلب بثقة عالية</p>
                <p className="text-[11px] text-emerald-800 mt-1">مُعبَّأة بالفعل بمنتجات استخرجناها من وصف بوسطة — راجع وضغط "حفظ"</p>
              </div>
              <button
                onClick={confirmHighConfidence}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition"
              >
                ⚡ تأكيد الكل
              </button>
            </div>
          )}

          {summary.count > 0 && (
            <div className="sticky top-2 z-30 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 px-5 py-3 flex items-center justify-between gap-3 flex-wrap border-2 border-blue-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-black">جاهز لـ backfill {fmt(summary.count)} طلب</p>
                  <p className="text-[11px] text-blue-50 mt-0.5">إجمالي القطع المضافة: <strong>{fmt(summary.units)}</strong></p>
                </div>
              </div>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 text-sm font-black transition disabled:opacity-50 shadow shrink-0"
              >
                {submitting ? '...جاري الحفظ' : '💾 حفظ الـ Backfill'}
              </button>
            </div>
          )}

          {/* Per-order cards. Each card shows the order header, the
              parsed bosta description, and a multi-item editor table. */}
          <div className="space-y-3">
            {rows.map(r => (
              <OrphanCard
                key={r.orderId}
                row={r}
                products={products}
                draft={drafts[r.orderId] ?? { items: [], skip: false }}
                onAdd={() => addItem(r.orderId)}
                onRemove={i => removeItem(r.orderId, i)}
                onUpdate={(i, p) => updateItem(r.orderId, i, p)}
                onSetSkip={s => setSkip(r.orderId, s)}
                onRescale={target => rescaleToOrderTotal(r.orderId, target)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrphanCard({
  row, products, draft,
  onAdd, onRemove, onUpdate, onSetSkip, onRescale,
}: {
  row: OrphanRow;
  products: Product[];
  draft: Draft;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, p: Partial<DraftItem>) => void;
  onSetSkip: (s: boolean) => void;
  onRescale: (target: number) => void;
}) {
  const sumDraft = draft.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  // The recorded price (Order.total) is the truth; if the admin's items
  // sum to something different, we flag the discrepancy. The "anchor"
  // here is order.total when set, otherwise cod, otherwise null.
  const anchor = row.orderTotal > 0 ? row.orderTotal : row.cod > 0 ? row.cod : null;
  const matchesAnchor = anchor === null
    ? null
    : Math.abs(sumDraft - anchor) / Math.max(anchor, 1) < 0.05;
  const confTone = row.confidence >= 0.8 ? 'bg-emerald-100 text-emerald-800'
    : row.confidence >= 0.5 ? 'bg-amber-100 text-amber-800'
    : 'bg-red-100 text-red-800';

  return (
    <div className={`bg-white border rounded-2xl p-4 ${draft.skip ? 'opacity-50 border-gray-200' : 'border-gray-300'}`}>
      {/* Header: order info + confidence chip + skip toggle */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/admin/orders?highlight=${row.orderId}`} className="text-blue-700 hover:underline font-mono font-bold text-sm">
              #{row.orderId.slice(-6).toUpperCase()}
            </Link>
            <span className="text-[10px] text-gray-500 font-mono" dir="ltr">{fmtDate(row.createdAt)}</span>
            {row.trackingNumber && <span className="text-[10px] text-gray-400 font-mono" dir="ltr">{row.trackingNumber}</span>}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${confTone}`}>
              ثقة {Math.round(row.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm font-bold text-gray-800 mt-1">{row.customerName ?? 'ضيف'}</p>
          <p className="text-[11px] text-gray-500">{row.paymentNote}</p>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
          <input type="checkbox" checked={draft.skip} onChange={e => onSetSkip(e.target.checked)} className="w-4 h-4" />
          تخطّي هذا الطلب
        </label>
      </div>

      {/* Bosta description preview — collapsed when long */}
      {row.description && (
        <details className="mb-3">
          <summary className="text-[11px] text-gray-600 cursor-pointer hover:text-gray-900">📝 وصف بوسطة الأصلي</summary>
          <p className="text-[11px] text-gray-600 bg-gray-50 rounded-lg p-2 mt-1 leading-relaxed">{row.description}</p>
          {row.parsedItems.length > 0 && (
            <p className="text-[10px] text-gray-500 mt-1">
              النظام استخرج: {row.parsedItems.map(p => `${p.name} ×${p.quantity}`).join(' · ')}
            </p>
          )}
        </details>
      )}

      {/* Multi-item editor */}
      <div className="space-y-2">
        {draft.items.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic text-center py-2">مفيش منتجات لسه — اضغط "إضافة منتج" لتبدأ</p>
        ) : draft.items.map((it, idx) => {
          const lineTotal = it.quantity * it.unitPrice;
          const matchedSuggestion = row.suggestedItems.find(s => s.productId === it.productId);
          return (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-6">
                <select
                  value={it.productId}
                  onChange={e => onUpdate(idx, { productId: e.target.value })}
                  disabled={draft.skip}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#F5C518] disabled:bg-gray-100"
                >
                  <option value="">— اختر منتج —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.price)}</option>)}
                </select>
                {matchedSuggestion && (
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    من الوصف: "{matchedSuggestion.parsedName}" (تطابق {Math.round(matchedSuggestion.matchScore * 100)}%)
                  </p>
                )}
              </div>
              <div className="col-span-3 sm:col-span-2">
                <label className="text-[9px] text-gray-500 font-bold block mb-0.5">الكمية</label>
                <input
                  type="number" min="1" step="1"
                  value={it.quantity}
                  onChange={e => onUpdate(idx, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  disabled={draft.skip}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#F5C518] disabled:bg-gray-100"
                  dir="ltr"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="text-[9px] text-gray-500 font-bold block mb-0.5">سعر الوحدة</label>
                <input
                  type="number" min="0" step="0.01"
                  value={it.unitPrice}
                  onChange={e => onUpdate(idx, { unitPrice: Number(e.target.value) || 0 })}
                  disabled={draft.skip}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#F5C518] disabled:bg-gray-100"
                  dir="ltr"
                />
              </div>
              <div className="col-span-3 sm:col-span-1 text-[10px] font-bold text-gray-700 text-left" dir="ltr">
                {fmtMoney(lineTotal)}
              </div>
              <div className="col-span-2 sm:col-span-1 text-left">
                <button
                  onClick={() => onRemove(idx)}
                  disabled={draft.skip}
                  className="text-red-500 hover:text-red-700 text-xs font-bold disabled:opacity-50"
                  title="حذف"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onAdd}
            disabled={draft.skip}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition disabled:opacity-50"
          >
            + إضافة منتج
          </button>
          {draft.items.length > 0 && (
            <ReconciliationBadge
              sumDraft={sumDraft}
              orderTotal={row.orderTotal}
              cod={row.cod}
              matches={matchesAnchor}
              onRescale={anchor !== null && !matchesAnchor && sumDraft > 0 ? () => onRescale(anchor) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Visual indicator: do the line totals add up to the recorded order
// price? Green if yes, red if no, neutral if no anchor exists. Offers
// a one-click "rescale to match" action when prices have drifted.
function ReconciliationBadge({
  sumDraft, orderTotal, cod, matches, onRescale,
}: {
  sumDraft: number;
  orderTotal: number;
  cod: number;
  matches: boolean | null;
  onRescale?: () => void;
}) {
  const anchor = orderTotal > 0 ? orderTotal : cod > 0 ? cod : 0;
  if (anchor === 0) {
    return (
      <div className="text-[10px] text-gray-500 text-left">
        إجمالي العناصر: <strong className="text-gray-800">{fmtMoney(sumDraft)}</strong>
        <span className="text-gray-400 mr-1">(لا يوجد سعر مسجَّل للمقارنة)</span>
      </div>
    );
  }
  const tone = matches ? 'text-emerald-700' : 'text-red-700';
  const icon = matches ? '✓' : '⚠';
  return (
    <div className="text-[10px] text-left flex items-center gap-2">
      <div>
        <p>إجمالي: <strong className={tone}>{fmtMoney(sumDraft)}</strong></p>
        <p className="text-gray-500">السعر المسجَّل: <strong>{fmtMoney(anchor)}</strong></p>
      </div>
      <span className={`text-base ${tone}`}>{icon}</span>
      {!matches && onRescale && (
        <button
          onClick={onRescale}
          className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold transition whitespace-nowrap"
          title="ضبط أسعار العناصر لتطابق السعر المسجَّل"
        >
          ضبط الأسعار
        </button>
      )}
    </div>
  );
}

function DiagBox({ label, value, tone }: { label: string; value: number; tone: 'gray' | 'amber' }) {
  const cls = tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`rounded-lg border px-2 py-1 ${cls}`}>
      <p className="font-bold tracking-wide">{label}</p>
      <p className="text-sm font-black mt-0.5">{fmt(value)}</p>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}>
      <p className="text-[10px] text-white/60 font-bold tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${highlight ? 'text-[#F5C518]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[9px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}
