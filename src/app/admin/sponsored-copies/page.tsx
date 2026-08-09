'use client';

import { useEffect, useState, useCallback } from 'react';

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'متاحة', RESERVED: 'محجوزة', ASSIGNED: 'مخصصة',
  IN_PREPARATION: 'قيد التجهيز', READY_TO_SHIP: 'جاهزة للشحن',
  SHIPPED: 'مشحونة', DELIVERED: 'وصلت', CONFIRMED: 'مؤكدة',
  COMPLETED: 'مكتملة', CANCELLED: 'ملغاة', REFUNDED: 'مستردة',
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800', RESERVED: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800', IN_PREPARATION: 'bg-orange-100 text-orange-800',
  READY_TO_SHIP: 'bg-teal-100 text-teal-800', SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-indigo-100 text-indigo-800', CONFIRMED: 'bg-green-200 text-green-900',
  COMPLETED: 'bg-gray-100 text-gray-600', CANCELLED: 'bg-red-100 text-red-600',
  REFUNDED: 'bg-red-100 text-red-600',
};

interface Copy {
  id: string; code: string; status: string; currency: string;
  originalPrice: number; paidPrice: number;
  purchasedAt: string; shippedAt?: string; deliveredAt?: string;
  product: { id: string; name: string };
  sponsor: { id: string; name: string; organization?: string };
  beneficiaryUser?: { id: string; name: string } | null;
}

export default function AdminSponsoredCopiesPage() {
  const [copies, setCopies] = useState<Copy[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (statusFilter) q.set('status', statusFilter);
    if (search) q.set('search', search);
    const res = await fetch(`/api/admin/sponsored-copies?${q}`);
    if (res.ok) {
      const data = await res.json();
      setCopies(data.copies); setTotal(data.total); setPages(data.pages);
    }
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">النسخ المدعومة</h1>
          <p className="text-gray-500 text-sm mt-1">إجمالي: {total} نسخة</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/sponsored-orders" className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">طلبات الشراء</a>
          <a href="/admin/sponsors" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">الداعمون</a>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="text" placeholder="كود النسخة..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px]" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">جاري التحميل...</div>
        ) : copies.length === 0 ? (
          <div className="p-12 text-center text-gray-400">لا توجد نسخ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right p-3 font-medium text-gray-600">الكود</th>
                  <th className="text-right p-3 font-medium text-gray-600">المنتج</th>
                  <th className="text-right p-3 font-medium text-gray-600">الداعم</th>
                  <th className="text-right p-3 font-medium text-gray-600">المستفيد</th>
                  <th className="text-right p-3 font-medium text-gray-600">السعر</th>
                  <th className="text-right p-3 font-medium text-gray-600">الحالة</th>
                  <th className="text-right p-3 font-medium text-gray-600">تاريخ الشراء</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {copies.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="p-3 font-mono font-bold text-gray-700">{c.code}</td>
                    <td className="p-3 text-gray-800">{c.product.name}</td>
                    <td className="p-3">
                      <div>{c.sponsor.name}</div>
                      {c.sponsor.organization && <div className="text-xs text-gray-400">{c.sponsor.organization}</div>}
                    </td>
                    <td className="p-3 text-gray-600">{c.beneficiaryUser?.name ?? '—'}</td>
                    <td className="p-3 text-gray-800">{fmt(c.originalPrice)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-xs">
                      {new Date(c.purchasedAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="p-3">
                      <a href={`/admin/sponsored-copies/${c.id}`} className="text-blue-600 hover:underline text-xs">عرض</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
