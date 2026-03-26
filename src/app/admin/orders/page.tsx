'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

interface DbOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  paymentMethod: string;
  currency: string;
  user: { id: string; name: string; email: string };
}

const STATUSES = ['قيد التجهيز', 'تم الشحن', 'تم التسليم', 'ملغي'];

const STATUS_COLORS: Record<string, string> = {
  'قيد التجهيز': 'bg-amber-100 text-amber-700',
  'تم الشحن':    'bg-blue-100 text-blue-700',
  'تم التسليم':  'bg-green-100 text-green-700',
  'ملغي':        'bg-red-100 text-red-700',
  'pending':     'bg-amber-100 text-amber-700',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  'قيد التجهيز': 'bg-amber-50 border-amber-200 text-amber-700',
  'تم الشحن':    'bg-blue-50 border-blue-200 text-blue-700',
  'تم التسليم':  'bg-green-50 border-green-200 text-green-700',
  'ملغي':        'bg-red-50 border-red-200 text-red-700',
  'pending':     'bg-amber-50 border-amber-200 text-amber-700',
};

function normalizeStatus(s: string): string {
  if (s === 'pending' || s === 'processing') return 'قيد التجهيز';
  if (s === 'shipped') return 'تم الشحن';
  if (s === 'delivered') return 'تم التسليم';
  if (s === 'cancelled') return 'ملغي';
  return s;
}

function InvoiceModal({ order, onClose }: { order: DbOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-6 py-5 flex items-center justify-between">
          <Image src="/white-Logo.webp" alt="Moslim Leader" width={120} height={40} className="h-10 w-auto" unoptimized />
          <div className="text-left">
            <p className="text-[#F5C518] text-xs font-bold tracking-wide">فاتورة الطلب</p>
            <p className="text-white/60 text-xs mt-0.5">{new Date(order.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold">رقم الطلب</p>
            <p className="text-xl font-black text-gray-900">#{order.id.slice(-6)}</p>
          </div>
          <span className={`text-xs font-bold border px-3 py-1.5 rounded-full ${STATUS_BADGE_COLORS[order.status] || 'bg-gray-50 border-gray-200 text-gray-600'}`}>{order.status}</span>
        </div>
        <div className="px-6 py-4 border-b border-gray-100 space-y-2">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">بيانات العميل</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1a1a2e] flex items-center justify-center text-[#F5C518] font-black text-sm shrink-0">
              {(order.user?.name || 'ض').charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{order.user?.name || 'ضيف'}</p>
              <p className="text-xs text-gray-400">{order.user?.email}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">إجمالي الطلب</span>
            <span className="text-2xl font-black text-gray-900">{order.total.toLocaleString('ar-EG')} <span className="text-sm font-semibold text-gray-400">ج.م</span></span>
          </div>
        </div>
        <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-6 py-3 flex items-center justify-between">
          <p className="text-white/50 text-xs">moslimleader.com</p>
          <p className="text-[#F5C518]/80 text-xs font-semibold">جزاك الله خيرًا</p>
        </div>
        <div className="px-6 py-4 text-center">
          <button onClick={onClose} className="bg-[#1a1a2e] hover:bg-[#2d1060] text-white font-bold px-8 py-2.5 rounded-xl text-sm transition">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [invoiceOrder, setInvoiceOrder] = useState<DbOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders', { credentials: 'include' });
      const { orders: raw }: { orders: DbOrder[] } = await res.json();
      setOrders((raw ?? []).map(o => ({ ...o, status: normalizeStatus(o.status) })));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (order: DbOrder, status: string) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));
    await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
  };

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter;
    const matchSearch = !search
      || o.id.includes(search)
      || (o.user?.name || '').includes(search)
      || (o.user?.email || '').includes(search);
    return matchFilter && matchSearch;
  });

  const totalRevenue = filtered.filter(o => o.status !== 'ملغي').reduce((s, o) => s + o.total, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {invoiceOrder && <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}

      <div>
        <h1 className="text-xl font-black text-gray-900">الطلبات</h1>
        <p className="text-sm text-gray-500 mt-0.5">{orders.length} طلب إجمالاً</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث برقم الطلب أو اسم العميل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-72"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {s === 'all' ? 'الكل' : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="text-sm text-gray-500">
          {filtered.length} طلب — إجمالي: <span className="font-bold text-gray-900">{totalRevenue.toLocaleString('ar-EG')} ج.م</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-3">📭</p><p className="font-semibold">لا توجد طلبات</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold">
                  <th className="px-5 py-3.5 text-right">رقم الطلب</th>
                  <th className="px-5 py-3.5 text-right">العميل</th>
                  <th className="px-5 py-3.5 text-right">التاريخ</th>
                  <th className="px-5 py-3.5 text-right">المبلغ</th>
                  <th className="px-5 py-3.5 text-right">الحالة</th>
                  <th className="px-5 py-3.5 text-right">تغيير الحالة</th>
                  <th className="px-5 py-3.5 text-right">فاتورة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-gray-900">#{o.id.slice(-6)}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{o.user?.name || 'ضيف'}</p>
                      <p className="text-xs text-gray-400">{o.user?.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">{o.total.toLocaleString('ar-EG')} ج</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select value={o.status} onChange={e => handleStatus(o, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gray-400 bg-white cursor-pointer">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setInvoiceOrder(o)}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#6B21A8] bg-purple-50 hover:bg-purple-100 border border-purple-100 px-3 py-1.5 rounded-lg transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        فاتورة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
