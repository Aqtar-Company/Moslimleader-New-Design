'use client';

import { useEffect, useState, useCallback } from 'react';

interface Shipment {
  id: string;
  orderId: string;
  provider: string;
  bostaDeliveryId: string | null;
  trackingNumber: string | null;
  status: string;
  state: string | null;
  cod: number;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    status: string;
    total: number;
    currency: string;
    paymentMethod: string;
    createdAt: string;
    shippingAddress: { firstName?: string; lastName?: string; phone?: string; city?: string; governorate?: string };
    user: { name: string; email: string };
  };
}

const STATUS_LABELS: Record<string, string> = {
  created: 'تم الإنشاء',
  shipped: 'في الطريق',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-amber-100 text-amber-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shipments', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setShipments(data.shipments ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/admin/shipments/${id}/refresh`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (data.shipment) {
        setShipments(prev => prev.map(s => s.id === id ? { ...s, ...data.shipment } : s));
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert('فشل التحديث');
    }
    setRefreshingId(null);
  };

  const filtered = shipments.filter(s => {
    const matchFilter = filter === 'all' || s.status === filter;
    const q = search.trim().toLowerCase();
    if (!q) return matchFilter;
    const matchSearch =
      s.orderId.toLowerCase().includes(q) ||
      (s.trackingNumber || '').toLowerCase().includes(q) ||
      (s.order?.user?.name || '').toLowerCase().includes(q) ||
      (s.order?.user?.email || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">شحنات بوسطة</h1>
        <p className="text-sm text-gray-500 mt-0.5">{shipments.length} شحنة</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث برقم التتبع، رقم الطلب، أو العميل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-80"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', 'created', 'shipped', 'delivered', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {s === 'all' ? 'الكل' : (STATUS_LABELS[s] || s)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-3">📦</p><p className="font-semibold">لا توجد شحنات</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold">
                  <th className="px-5 py-3.5 text-right">رقم الطلب</th>
                  <th className="px-5 py-3.5 text-right">رقم التتبع</th>
                  <th className="px-5 py-3.5 text-right">العميل</th>
                  <th className="px-5 py-3.5 text-right">الوجهة</th>
                  <th className="px-5 py-3.5 text-right">COD</th>
                  <th className="px-5 py-3.5 text-right">الحالة</th>
                  <th className="px-5 py-3.5 text-right">آخر حالة بوسطة</th>
                  <th className="px-5 py-3.5 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-mono font-bold text-gray-900">#{s.orderId.slice(-6).toUpperCase()}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-700">{s.trackingNumber || '—'}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{s.order?.user?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{s.order?.shippingAddress?.phone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {s.order?.shippingAddress?.governorate || '—'}
                      {s.order?.shippingAddress?.city ? ` — ${s.order.shippingAddress.city}` : ''}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-bold text-gray-700">
                      {s.cod > 0 ? `${s.cod} EGP` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">{s.state || '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 items-center">
                        {s.trackingNumber && (
                          <a
                            href={`https://bosta.co/track-shipment/${s.trackingNumber}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs font-bold text-blue-600 hover:underline"
                          >تتبع</a>
                        )}
                        <button
                          onClick={() => refresh(s.id)}
                          disabled={refreshingId === s.id}
                          className="text-xs font-bold text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          {refreshingId === s.id ? '...' : 'تحديث'}
                        </button>
                      </div>
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
