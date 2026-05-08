'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Row {
  productId: string;
  productName: string;
  productSlug: string;
  category: string;
  retailPrice: number;
  currentStock: number;
  unitsAll: number;
  unitsLive: number;
  unitsImported: number;
  unitsGift: number;
  orderCount: number;
  revenue: number;
  avgUnitPrice: number;
  firstSaleAt: string | null;
  lastSaleAt: string | null;
  productionBatchUnits: number;
  impliedOpeningBalance: number;
  needsOpeningBalance: boolean;
}

interface Totals {
  productsWithSales: number;
  productsNeedingBalance: number;
  unitsAll: number;
  unitsLive: number;
  unitsImported: number;
  unitsGift: number;
  revenue: number;
  impliedOpeningBalance: number;
}

interface DrilldownOrder {
  orderItemId: string;
  orderId: string;
  orderCreatedAt: string;
  status: string;
  paymentMethod: string;
  source: string | null;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  quantity: number;
  unitPrice: number;
  selectedModel: number | null;
}

const PAY_METHOD_LABELS: Record<string, { ar: string; icon: string }> = {
  cod: { ar: 'COD', icon: '💵' },
  card: { ar: 'بطاقة', icon: '💳' },
  paypal: { ar: 'PayPal', icon: '🅿️' },
  vodafone: { ar: 'فودافون', icon: '📱' },
  instapay: { ar: 'إنستاباي', icon: '⚡' },
  bank: { ar: 'بنكي', icon: '🏦' },
  gift: { ar: 'هدية', icon: '🎁' },
  'bosta-historical': { ar: 'استيراد بوسطة', icon: '📦' },
};

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-amber-100 text-amber-700',
  paid:        'bg-emerald-100 text-emerald-700',
  shipped:     'bg-blue-100 text-blue-700',
  delivered:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
  payment_failed: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد التجهيز', paid: 'تم الدفع', shipped: 'تم الشحن',
  delivered: 'تم التسليم', cancelled: 'ملغي', payment_failed: 'فشل الدفع',
};

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('en-US')} ج.م`;
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB') : '—';

type SourceFilter = 'all' | 'live' | 'imports' | 'gift' | 'no-batches';

export default function SalesByProductPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<Record<string, DrilldownOrder[]>>({});
  const [drilldownLoading, setDrilldownLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/reports/sales-by-product');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        setRows(data.rows);
        setTotals(data.totals);
      } catch (err) {
        if (err instanceof ForbiddenError) setForbidden(true);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.productName.toLowerCase().includes(q)) return false;
      if (sourceFilter === 'live' && r.unitsLive === 0) return false;
      if (sourceFilter === 'imports' && r.unitsImported === 0) return false;
      if (sourceFilter === 'gift' && r.unitsGift === 0) return false;
      if (sourceFilter === 'no-batches' && !r.needsOpeningBalance) return false;
      return r.unitsAll > 0; // hide products with zero sales — they clutter the table
    });
  }, [rows, search, sourceFilter]);

  const toggleExpand = async (productId: string) => {
    if (expandedId === productId) { setExpandedId(null); return; }
    setExpandedId(productId);
    if (drilldown[productId]) return; // cached
    setDrilldownLoading(prev => new Set(prev).add(productId));
    try {
      const res = await adminFetch(`/api/admin/reports/sales-by-product?productId=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setDrilldown(prev => ({ ...prev, [productId]: data.orders }));
      }
    } catch { /* swallow */ }
    setDrilldownLoading(prev => { const next = new Set(prev); next.delete(productId); return next; });
  };

  if (forbidden) return <ForbiddenState requiredPerm="valuation.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900">📊 توزيع المبيعات على المنتجات</h1>
        <p className="text-sm text-gray-500 mt-0.5">شوف لكل منتج: قد إيه اتباع منه، من فين (live / استيراد / هدية)، وعدد الطلبات</p>
      </div>

      {/* KPIs */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="منتجات بمبيعات" value={fmt(totals.productsWithSales)} />
          <KPI label="إجمالي القطع المباعة" value={fmt(totals.unitsAll)} sub={`live: ${fmt(totals.unitsLive)} · استيراد: ${fmt(totals.unitsImported)} · هدية: ${fmt(totals.unitsGift)}`} />
          <KPI label="إجمالي الإيرادات" value={fmtMoney(totals.revenue)} />
          <KPI
            label="منتجات محتاجة تسعير افتتاحي"
            value={fmt(totals.productsNeedingBalance)}
            tone={totals.productsNeedingBalance > 0 ? 'bad' : 'ok'}
            sub={totals.productsNeedingBalance > 0 ? `${fmt(totals.impliedOpeningBalance)} قطعة بدون باتش` : 'مفيش'}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث باسم المنتج..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-gray-400 w-full sm:w-64"
        />
        <div className="flex gap-2 flex-wrap">
          {([
            { k: 'all',         label: '📋 الكل' },
            { k: 'live',        label: '🟢 live' },
            { k: 'imports',     label: '📦 استيراد' },
            { k: 'gift',        label: '🎁 هدايا' },
            { k: 'no-batches',  label: '🟥 محتاج تسعير' },
          ] as const).map(f => (
            <button
              key={f.k}
              onClick={() => setSourceFilter(f.k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${sourceFilter === f.k ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="مفيش منتجات مطابقة" icon="📊" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-right w-6"></th>
                  <th className="px-3 py-3 text-right">المنتج</th>
                  <th className="px-3 py-3 text-right">إجمالي مباع</th>
                  <th className="px-3 py-3 text-right">live</th>
                  <th className="px-3 py-3 text-right">استيراد</th>
                  <th className="px-3 py-3 text-right">هدية</th>
                  <th className="px-3 py-3 text-right">طلبات</th>
                  <th className="px-3 py-3 text-right">إيرادات</th>
                  <th className="px-3 py-3 text-right">مخزون حالي</th>
                  <th className="px-3 py-3 text-right">باتشات</th>
                  <th className="px-3 py-3 text-right">من — إلى</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const isOpen = expandedId === r.productId;
                  const orders = drilldown[r.productId];
                  const isOrdersLoading = drilldownLoading.has(r.productId);
                  return (
                    <Fragment key={r.productId}>
                      <tr
                        className={`cursor-pointer transition ${isOpen ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleExpand(r.productId)}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block w-5 h-5 rounded text-[10px] flex items-center justify-center ${isOpen ? 'bg-[#F5C518] text-[#1a1a2e] rotate-180' : 'bg-gray-100 text-gray-500'}`}>▼</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                            {r.productName}
                            {r.needsOpeningBalance && (
                              <Link href={`/admin/production/seed-stock`} onClick={e => e.stopPropagation()} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black hover:bg-red-200 transition">
                                🟥 محتاج تسعير افتتاحي
                              </Link>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400">{r.category} · {fmt(r.retailPrice)} ج.م</p>
                        </td>
                        <td className="px-3 py-2.5 font-black text-gray-900">{fmt(r.unitsAll)}</td>
                        <td className="px-3 py-2.5 text-emerald-700">{fmt(r.unitsLive)}</td>
                        <td className="px-3 py-2.5 text-blue-700">{fmt(r.unitsImported)}</td>
                        <td className="px-3 py-2.5 text-pink-700">{fmt(r.unitsGift)}</td>
                        <td className="px-3 py-2.5">{fmt(r.orderCount)}</td>
                        <td className="px-3 py-2.5 font-bold">{fmtMoney(r.revenue)}</td>
                        <td className="px-3 py-2.5">
                          <span className={r.currentStock === 0 ? 'text-red-700 font-black' : 'text-gray-700'}>{fmt(r.currentStock)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={r.productionBatchUnits === 0 ? 'text-red-700 font-black' : 'text-gray-700'}>{fmt(r.productionBatchUnits)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] text-gray-500 whitespace-nowrap" dir="ltr">
                          {fmtDate(r.firstSaleAt)} → {fmtDate(r.lastSaleAt)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={11} className="bg-gray-50 p-4">
                            {isOrdersLoading ? (
                              <Spinner />
                            ) : !orders || orders.length === 0 ? (
                              <p className="text-xs text-gray-500 text-center py-4">مفيش طلبات</p>
                            ) : (
                              <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-gray-100 text-[9px] text-gray-500 font-bold uppercase">
                                    <tr>
                                      <th className="px-2 py-2 text-right">الطلب</th>
                                      <th className="px-2 py-2 text-right">التاريخ</th>
                                      <th className="px-2 py-2 text-right">العميل</th>
                                      <th className="px-2 py-2 text-right">الحالة</th>
                                      <th className="px-2 py-2 text-right">الدفع</th>
                                      <th className="px-2 py-2 text-right">الكمية</th>
                                      <th className="px-2 py-2 text-right">السعر</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {orders.map(o => {
                                      const payInfo = PAY_METHOD_LABELS[o.paymentMethod] || { ar: o.paymentMethod, icon: '💰' };
                                      return (
                                        <tr key={o.orderItemId} className="hover:bg-gray-50">
                                          <td className="px-2 py-1.5">
                                            <Link href={`/admin/orders?highlight=${o.orderId}`} className="text-blue-700 hover:underline font-mono font-bold">
                                              #{o.orderId.slice(-6).toUpperCase()}
                                            </Link>
                                          </td>
                                          <td className="px-2 py-1.5 text-gray-600 font-mono text-[10px]" dir="ltr">{fmtDate(o.orderCreatedAt)}</td>
                                          <td className="px-2 py-1.5">
                                            <p className="font-bold text-gray-800">{o.customerName || 'ضيف'}</p>
                                            {o.customerEmail && <p className="text-[9px] text-gray-400" dir="ltr">{o.customerEmail}</p>}
                                          </td>
                                          <td className="px-2 py-1.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                                              {STATUS_LABELS[o.status] || o.status}
                                            </span>
                                          </td>
                                          <td className="px-2 py-1.5">
                                            <span className="text-[10px] font-bold">{payInfo.icon} {payInfo.ar}</span>
                                            {o.source && <span className="text-[9px] text-blue-700 mr-1">({o.source})</span>}
                                          </td>
                                          <td className="px-2 py-1.5 font-black">{fmt(o.quantity)}</td>
                                          <td className="px-2 py-1.5 font-bold" dir="ltr">{fmt(o.unitPrice)} {o.currency}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'ok' }) {
  const cls = tone === 'bad' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 font-bold tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
