'use client';

import { useEffect, useState, useCallback } from 'react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'معلق',
  UNDER_REVIEW: 'قيد المراجعة',
  APPROVED: 'موافق — ML',
  REJECTED: 'مرفوض',
  MATCHED_WITH_SPONSORED_COPY: 'تم تخصيص نسخة',
  READY_FOR_CHECKOUT: 'جاهز للدفع',
  USED: 'مستخدم',
  EXPIRED: 'منتهي',
  CANCELLED: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  MATCHED_WITH_SPONSORED_COPY: 'bg-purple-100 text-purple-800',
  READY_FOR_CHECKOUT: 'bg-teal-100 text-teal-800',
  USED: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const REASON_LABELS: Record<string, string> = {
  student: 'طالب',
  multiple_children: 'أكثر من طفل',
  temp_financial: 'ظرف مالي مؤقت',
  price_barrier: 'السعر يمثل عائقًا',
  other: 'أخرى',
};

interface SupportRequest {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail: string;
  country: string;
  reason: string;
  status: string;
  supportType?: string;
  snapshotProductPrice: number;
  mlSupportAmount?: number;
  customerPayAmount?: number;
  createdAt: string;
  product: { id: string; name: string; images: unknown[] };
  mlAllocation?: { supportAmount: number; customerPayAmount: number; status: string } | null;
  assignedCopy?: { id: string; code: string; status: string; sponsor: { name: string } } | null;
  availableSponsoredCopies: number;
}

export default function AdminSupportRequestsPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (statusFilter) q.set('status', statusFilter);
    if (search) q.set('search', search);

    const res = await fetch(`/api/admin/support-requests?${q}`);
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests);
      setTotal(data.total);
      setPages(data.pages);
    }
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString('ar-EG') + ' ج.م';

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طلبات دعم السعر</h1>
          <p className="text-gray-500 text-sm mt-1">إجمالي: {total} طلب</p>
        </div>
        <a
          href="/admin/support-reports"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          تقارير الدعم
        </a>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <div className="flex gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="بحث باسم أو إيميل..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => { setSearch(searchInput); setPage(1); }}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700"
          >
            بحث
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">جاري التحميل...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-400">لا توجد طلبات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-right p-3 font-medium text-gray-600">العميل</th>
                  <th className="text-right p-3 font-medium text-gray-600">المنتج</th>
                  <th className="text-right p-3 font-medium text-gray-600">السعر</th>
                  <th className="text-right p-3 font-medium text-gray-600">السبب</th>
                  <th className="text-right p-3 font-medium text-gray-600">نسخ متاحة</th>
                  <th className="text-right p-3 font-medium text-gray-600">الحالة</th>
                  <th className="text-right p-3 font-medium text-gray-600">التاريخ</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{r.customerName}</div>
                      <div className="text-gray-400 text-xs">{r.customerPhone || r.customerEmail}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-gray-800 font-medium">{r.product.name}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-gray-800">{fmt(r.snapshotProductPrice)}</div>
                      {r.mlAllocation && (
                        <div className="text-green-600 text-xs">دعم: {fmt(r.mlAllocation.supportAmount)}</div>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${r.availableSponsoredCopies > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {r.availableSponsoredCopies}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-xs">
                      {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="p-3">
                      <a
                        href={`/admin/support-requests/${r.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        مراجعة
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
