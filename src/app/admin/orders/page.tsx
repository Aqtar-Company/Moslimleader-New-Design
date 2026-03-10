'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAllOrders, setOrderStatus, AdminOrder } from '@/lib/admin-storage';

const STATUSES = ['قيد التجهيز', 'تم الشحن', 'تم التسليم', 'ملغي'];

const STATUS_COLORS: Record<string, string> = {
  'قيد التجهيز': 'bg-amber-100 text-amber-700',
  'تم الشحن': 'bg-blue-100 text-blue-700',
  'تم التسليم': 'bg-green-100 text-green-700',
  'ملغي': 'bg-red-100 text-red-700',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setOrders(getAllOrders());
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = (order: AdminOrder, status: string) => {
    setOrderStatus(order.id, status);
    load();
  };

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter;
    const matchSearch = !search || o.id.includes(search) || o.userName.includes(search) || o.userEmail.includes(search);
    return matchFilter && matchSearch;
  });

  const totalRevenue = filtered.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">الطلبات</h1>
        <p className="text-sm text-gray-500 mt-0.5">{orders.length} طلب إجمالاً</p>
      </div>

      {/* Filters */}
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
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                filter === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-semibold">لا توجد طلبات</p>
          </div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(o => (
                  <tr key={`${o.userId}-${o.id}`} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-gray-900">#{o.id}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{o.userName || 'ضيف'}</p>
                      <p className="text-xs text-gray-400">{o.userEmail}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{o.date}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">{o.total.toLocaleString('ar-EG')} ج</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={o.status}
                        onChange={e => handleStatus(o, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gray-400 bg-white cursor-pointer"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
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
