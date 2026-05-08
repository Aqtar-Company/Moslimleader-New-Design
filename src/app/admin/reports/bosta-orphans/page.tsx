'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Suggestion {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  reason: string;
  confidence: number;
}

interface OrphanRow {
  orderId: string;
  createdAt: string;
  customerName: string | null;
  trackingNumber: string | null;
  cod: number;
  description: string | null;
  suggestions: Suggestion[];
}

interface Product { id: string; name: string; price: number }

interface Draft {
  productId: string;
  quantity: number;
  unitPrice: number;
  skip: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB');
const conf = (c: number) => Math.round(c * 100);

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
      // Pre-fill drafts: top suggestion if confidence >= 0.5, otherwise leave empty.
      const initial: Record<string, Draft> = {};
      for (const r of data.rows as OrphanRow[]) {
        const top = r.suggestions[0];
        if (top && top.confidence >= 0.5) {
          initial[r.orderId] = {
            productId: top.productId,
            quantity: top.quantity,
            unitPrice: top.productPrice,
            skip: false,
          };
        } else {
          initial[r.orderId] = { productId: '', quantity: 1, unitPrice: 0, skip: false };
        }
      }
      setDrafts(initial);
      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProducts(pData.products || []);
      }
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const updateDraft = (orderId: string, patch: Partial<Draft>) => {
    setDrafts(prev => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  };

  const summary = useMemo(() => {
    let count = 0;
    let units = 0;
    for (const r of rows) {
      const d = drafts[r.orderId];
      if (!d || d.skip || !d.productId || d.quantity <= 0) continue;
      count++;
      units += d.quantity;
    }
    return { count, units };
  }, [rows, drafts]);

  const submit = async () => {
    if (submitting || summary.count === 0) {
      if (summary.count === 0) addToast('اختر منتج لسطر واحد على الأقل', 'warning');
      return;
    }
    setSubmitting(true);
    const entries = rows.flatMap(r => {
      const d = drafts[r.orderId];
      if (!d || d.skip || !d.productId || d.quantity <= 0) return [];
      return [{ orderId: r.orderId, productId: d.productId, quantity: d.quantity, unitPrice: d.unitPrice }];
    });
    try {
      const res = await adminFetch('/api/admin/reports/bosta-orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل الحفظ', 'error'); setSubmitting(false); return; }
      addToast(`تم backfill لـ ${data.created} طلب${data.skipped > 0 ? ` (${data.skipped} تم تخطيها)` : ''}`, 'success', 6000);
      // Reload to refresh the orphan list (fewer rows after backfill).
      await load();
    } catch {
      addToast('فشل الحفظ', 'error');
    }
    setSubmitting(false);
  };

  // One-click bulk-confirm all high-confidence rows. Sets skip=false on
  // any row whose top suggestion has confidence >= 0.8 and re-submits.
  const confirmHighConfidence = () => {
    const next = { ...drafts };
    let changed = 0;
    for (const r of rows) {
      const top = r.suggestions[0];
      if (top && top.confidence >= 0.8) {
        next[r.orderId] = {
          productId: top.productId,
          quantity: top.quantity,
          unitPrice: top.productPrice,
          skip: false,
        };
        changed++;
      }
    }
    setDrafts(next);
    if (changed > 0) addToast(`جاهز لتأكيد ${changed} اقتراح عالي الثقة — اضغط "حفظ"`, 'success');
  };

  if (forbidden) return <ForbiddenState requiredPerm="valuation.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" dir="rtl">
      <Link href="/admin/reports/sales-by-product" className="text-xs text-gray-500 hover:text-gray-900">← العودة لتوزيع المبيعات</Link>

      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl p-6 text-white">
        <h1 className="text-xl font-black flex items-center gap-2">📦 طلبات بوسطة محتاجة منتجات</h1>
        <p className="text-white/70 text-sm mt-2 max-w-2xl leading-relaxed">
          طلبات بوسطة المستوردة من تاريخ الشركة <strong className="text-[#F5C518]">ما عندهاش OrderItems</strong> — لذلك تقرير قطع المباعة بيقلل الأرقام الحقيقية.
          الصفحة دي بتحاول تستنتج المنتج من وصف بوسطة + قيمة COD، وتوريك تأكد أو تختار يدوياً.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          <Stat label="إجمالي طلبات بدون منتجات" value={fmt(totalOrphan)} />
          <Stat label="معروضة دلوقتي" value={fmt(rows.length)} sub="آخر 200" />
          <Stat label="اقتراحات عالية الثقة" value={fmt(highConfidenceCount)} highlight />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="مفيش طلبات بوسطة بدون منتجات — كله متعمله backfill" icon="✅" />
      ) : (
        <>
          {/* Bulk action bar */}
          {highConfidenceCount > 0 && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-black text-emerald-900">⚡ {fmt(highConfidenceCount)} اقتراح بثقة عالية (≥80%)</p>
                <p className="text-[11px] text-emerald-800 mt-1">تقدر تأكدهم كلهم بضغطة واحدة — راجع التفاصيل قبل الحفظ</p>
              </div>
              <button
                onClick={confirmHighConfidence}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition"
              >
                ⚡ ملء الاقتراحات العالية
              </button>
            </div>
          )}

          {/* Sticky save bar */}
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

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-3 text-right">الطلب</th>
                    <th className="px-3 py-3 text-right">التاريخ</th>
                    <th className="px-3 py-3 text-right">العميل</th>
                    <th className="px-3 py-3 text-right">COD</th>
                    <th className="px-3 py-3 text-right">وصف بوسطة</th>
                    <th className="px-3 py-3 text-right">المنتج</th>
                    <th className="px-3 py-3 text-right">الكمية</th>
                    <th className="px-3 py-3 text-right">السعر</th>
                    <th className="px-3 py-3 text-right">تخطّي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => {
                    const d = drafts[r.orderId] ?? { productId: '', quantity: 1, unitPrice: 0, skip: false };
                    const top = r.suggestions[0];
                    return (
                      <tr key={r.orderId} className={d.skip ? 'bg-gray-50/50' : top?.confidence >= 0.8 ? 'bg-emerald-50/30' : ''}>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-blue-700">
                          <Link href={`/admin/orders?highlight=${r.orderId}`} className="hover:underline">
                            #{r.orderId.slice(-6).toUpperCase()}
                          </Link>
                          {r.trackingNumber && <p className="text-[9px] text-gray-400 mt-0.5">{r.trackingNumber}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-[10px] text-gray-600 font-mono whitespace-nowrap" dir="ltr">{fmtDate(r.createdAt)}</td>
                        <td className="px-3 py-2.5 text-gray-800">{r.customerName || 'ضيف'}</td>
                        <td className="px-3 py-2.5 font-bold text-purple-700" dir="ltr">{fmt(r.cod)} ج.م</td>
                        <td className="px-3 py-2.5 max-w-[180px]">
                          {r.description ? (
                            <p className="text-[10px] text-gray-600 line-clamp-2" title={r.description}>{r.description}</p>
                          ) : <span className="text-[10px] text-gray-400">— مفيش —</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={d.productId}
                            onChange={e => {
                              const sel = products.find(p => p.id === e.target.value);
                              updateDraft(r.orderId, {
                                productId: e.target.value,
                                unitPrice: sel?.price ?? d.unitPrice,
                              });
                            }}
                            disabled={d.skip}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#F5C518] disabled:bg-gray-100 w-full max-w-[180px]"
                          >
                            <option value="">— اختر —</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          {top && top.confidence > 0 && (
                            <p className="text-[9px] text-gray-500 mt-1">
                              اقتراح: <strong>{top.productName}</strong> · ثقة {conf(top.confidence)}%
                              <span className="text-gray-400 mr-1">({top.reason === 'name+price' ? 'اسم+سعر' : top.reason === 'name' ? 'اسم' : 'سعر'})</span>
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min="1" step="1"
                            value={d.quantity}
                            onChange={e => updateDraft(r.orderId, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                            disabled={d.skip}
                            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F5C518] disabled:bg-gray-100"
                            dir="ltr"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min="0" step="0.01"
                            value={d.unitPrice}
                            onChange={e => updateDraft(r.orderId, { unitPrice: Number(e.target.value) || 0 })}
                            disabled={d.skip}
                            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F5C518] disabled:bg-gray-100"
                            dir="ltr"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={d.skip}
                            onChange={e => updateDraft(r.orderId, { skip: e.target.checked })}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
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
