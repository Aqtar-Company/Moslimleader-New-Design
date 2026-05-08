'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Movement {
  id: string;
  createdAt: string;
  productId: string;
  productName: string;
  variantIndex: number | null;
  variantName: string | null;
  delta: number;
  reason: string;
  orderId: string | null;
  adminId: string | null;
  adminEmail: string | null;
  stockBefore: number;
  stockAfter: number;
  variantStockBefore: number | null;
  variantStockAfter: number | null;
  note: string | null;
}

interface Product { id: string; name: string }

const REASON_LABELS: Record<string, { label: string; tone: string }> = {
  order_created:        { label: 'خصم بطلب',                    tone: 'bg-red-100 text-red-700' },
  order_cancelled:      { label: 'إلغاء طلب (إعادة)',           tone: 'bg-emerald-100 text-emerald-700' },
  order_uncancelled:    { label: 'إعادة تفعيل طلب (خصم)',       tone: 'bg-orange-100 text-orange-700' },
  manual_adjustment:    { label: 'تعديل يدوي',                   tone: 'bg-blue-100 text-blue-700' },
  batch_created:        { label: 'باتش إنتاج',                   tone: 'bg-purple-100 text-purple-700' },
  opening_balance_seed: { label: 'تسعير افتتاحي',                tone: 'bg-amber-100 text-amber-700' },
};

const REASON_OPTIONS = Object.entries(REASON_LABELS).map(([k, v]) => ({ key: k, label: v.label }));

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
};

export default function StockMovementsPage() {
  const sp = useSearchParams();
  const initialProductId = sp.get('productId') ?? '';

  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [productId, setProductId] = useState(initialProductId);
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (productId) params.set('productId', productId);
      if (reason) params.set('reason', reason);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const res = await adminFetch(`/api/admin/inventory/movements?${params}`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setMovements(data.movements);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
    }
    setLoading(false);
  }, [productId, reason, from, to, offset]);

  useEffect(() => { load(); }, [load]);

  // Product list for the filter — lite so we don't fetch images/etc.
  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/products?lite=true');
        if (res.ok) {
          const d = await res.json();
          setProducts(d.products || []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  if (forbidden) return <ForbiddenState requiredPerm="inventory.read" />;

  // Aggregate at the top so the user can see the net effect of the
  // currently filtered window — useful for "how many شنطة units actually
  // moved out this month".
  const totalDelta = movements.reduce((s, m) => s + m.delta, 0);
  const decrementsTotal = movements.filter(m => m.delta < 0).reduce((s, m) => s + Math.abs(m.delta), 0);
  const incrementsTotal = movements.filter(m => m.delta > 0).reduce((s, m) => s + m.delta, 0);

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900">🧾 سجل المخزون</h1>
        <p className="text-sm text-gray-500 mt-0.5">كل تغيّر في المخزون مع السبب والتاريخ والمسؤول</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] text-gray-500 font-bold mb-1">المنتج</label>
          <select value={productId} onChange={e => { setProductId(e.target.value); setOffset(0); }} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
            <option value="">— كل المنتجات —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 font-bold mb-1">السبب</label>
          <select value={reason} onChange={e => { setReason(e.target.value); setOffset(0); }} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
            <option value="">— كل الأسباب —</option>
            {REASON_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 font-bold mb-1">من</label>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setOffset(0); }} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" dir="ltr" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 font-bold mb-1">إلى</label>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setOffset(0); }} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" dir="ltr" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="عدد العمليات" value={fmt(total)} sub={`عرض ${movements.length}`} />
        <KPI label="إجمالي مخصوم" value={fmt(decrementsTotal)} tone="bad" />
        <KPI label="إجمالي مضاف" value={fmt(incrementsTotal)} tone="good" />
        <KPI label="صافي التغيير" value={(totalDelta >= 0 ? '+' : '') + fmt(totalDelta)} tone={totalDelta < 0 ? 'bad' : totalDelta > 0 ? 'good' : 'neutral'} />
      </div>

      {/* Movements table */}
      {loading ? <Spinner /> : movements.length === 0 ? (
        <EmptyState message="مفيش عمليات مطابقة" icon="🧾" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <p className="lg:hidden text-[10px] text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-200">↔️ اسحب الجدول جانبياً لرؤية كل الأعمدة</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-right">التاريخ</th>
                  <th className="px-3 py-3 text-right">المنتج</th>
                  <th className="px-3 py-3 text-right">السبب</th>
                  <th className="px-3 py-3 text-right">التغيير</th>
                  <th className="px-3 py-3 text-right">قبل ← بعد</th>
                  <th className="px-3 py-3 text-right">المرجع</th>
                  <th className="px-3 py-3 text-right">ملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map(m => {
                  const reasonInfo = REASON_LABELS[m.reason] ?? { label: m.reason, tone: 'bg-gray-100 text-gray-700' };
                  const deltaTone = m.delta < 0 ? 'text-red-700' : m.delta > 0 ? 'text-emerald-700' : 'text-gray-500';
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-[10px] text-gray-600 whitespace-nowrap" dir="ltr">{fmtDate(m.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-gray-900">{m.productName}</p>
                        {m.variantName && <p className="text-[10px] text-gray-500">{m.variantName}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${reasonInfo.tone}`}>{reasonInfo.label}</span>
                      </td>
                      <td className={`px-3 py-2.5 font-black ${deltaTone}`} dir="ltr">
                        {m.delta > 0 ? '+' : ''}{fmt(m.delta)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-gray-600" dir="ltr">
                        {fmt(m.stockBefore)} ← {fmt(m.stockAfter)}
                        {m.variantStockBefore !== null && m.variantStockAfter !== null && (
                          <span className="text-gray-400 mr-1"> (موديل: {fmt(m.variantStockBefore)} ← {fmt(m.variantStockAfter)})</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {m.orderId ? (
                          <Link href={`/admin/orders?highlight=${m.orderId}`} className="text-blue-700 hover:underline font-mono text-[10px]" dir="ltr">
                            #{m.orderId.slice(0, 8)}
                          </Link>
                        ) : m.adminEmail ? (
                          <span className="text-[10px] text-gray-600" dir="ltr">{m.adminEmail}</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-gray-600 max-w-[220px] truncate" title={m.note ?? ''}>
                        {m.note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center justify-between text-[10px] text-gray-600">
            <span>{fmt(offset + 1)} – {fmt(Math.min(offset + movements.length, total))} من {fmt(total)}</span>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="px-3 py-1 rounded bg-white border border-gray-200 disabled:opacity-50">السابق</button>
              <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="px-3 py-1 rounded bg-white border border-gray-200 disabled:opacity-50">التالي</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const valueClass = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 font-bold tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
