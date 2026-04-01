'use client';

import { useEffect, useState } from 'react';

interface DbUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  orderCount: number;
}

interface DbOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
}

function normalizeStatus(s: string): string {
  if (s === 'pending' || s === 'processing') return 'قيد التجهيز';
  if (s === 'shipped') return 'تم الشحن';
  if (s === 'delivered') return 'تم التسليم';
  if (s === 'cancelled') return 'ملغي';
  return s;
}

export default function UsersPage() {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<Record<string, DbOrder[]>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [allOrders, setAllOrders] = useState<(DbOrder & { userId: string })[]>([]);

  useEffect(() => {
    async function load() {
      const [usersRes, ordersRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/orders', { credentials: 'include' }),
      ]);
      const { users: u } = await usersRes.json();
      const { orders: o } = await ordersRes.json();
      setUsers(u ?? []);
      setAllOrders((o ?? []).map((ord: DbOrder & { user: { id: string } }) => ({ ...ord, userId: ord.user?.id })));
      setLoading(false);
    }
    load();
  }, []);

  const handleSelect = (u: DbUser) => {
    if (selectedId === u.id) { setSelectedId(null); return; }
    setSelectedId(u.id);
    if (!userOrders[u.id]) {
      const orders = allOrders.filter(o => o.userId === u.id);
      setUserOrders(prev => ({ ...prev, [u.id]: orders }));
    }
  };

  const filtered = users.filter(u =>
    !search || u.name.includes(search) || u.email.includes(search) || (u.phone && u.phone.includes(search))
  );

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">العملاء</h1>
        <p className="text-sm text-gray-500 mt-0.5">{users.length} عميل مسجل</p>
      </div>

      <input type="text" placeholder="ابحث بالاسم أو الإيميل أو الهاتف..." value={search}
        onChange={e => setSearch(e.target.value)}
        className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-72" />

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-3">👥</p><p className="font-semibold">لا يوجد عملاء مسجلون بعد</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-semibold">
                <th className="px-5 py-3.5 text-right">الاسم</th>
                <th className="px-5 py-3.5 text-right">البريد الإلكتروني</th>
                <th className="px-5 py-3.5 text-right">الهاتف</th>
                <th className="px-5 py-3.5 text-center">عدد الطلبات</th>
                <th className="px-5 py-3.5 text-center">عرض الطلبات</th>
                <th className="px-5 py-3.5 text-center">الأجهزة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <>
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F5C518] flex items-center justify-center text-xs font-black text-[#1a1a2e] shrink-0">{u.name.charAt(0)}</div>
                        <span className="font-semibold text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{u.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`font-bold ${u.orderCount > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{u.orderCount}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button onClick={() => handleSelect(u)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${selectedId === u.id ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                        {selectedId === u.id ? 'إخفاء' : 'عرض'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={async () => {
                          if (confirm(`إعادة تعيين أجهزة ${u.name}؟`)) {
                            const res = await fetch(`/api/admin/devices?userId=${u.id}`, { method: 'DELETE', credentials: 'include' });
                            if (res.ok) alert('تم إعادة تعيين الأجهزة بنجاح');
                          }
                        }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                      >
                        إعادة تعيين
                      </button>
                    </td>
                  </tr>
                  {selectedId === u.id && (
                    <tr key={`${u.id}-orders`}>
                      <td colSpan={6} className="bg-gray-50 px-5 py-4 border-b border-gray-100">
                        {(userOrders[u.id] ?? []).length === 0 ? (
                          <p className="text-gray-400 text-sm text-center py-3">لا توجد طلبات لهذا العميل</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 mb-2">طلبات {u.name}:</p>
                            {(userOrders[u.id] ?? []).map(o => (
                              <div key={o.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm">
                                <span className="font-mono font-bold text-gray-700">#{o.id.slice(-6)}</span>
                                <span className="text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</span>
                                <span className="font-bold text-gray-900">{o.total.toLocaleString('ar-EG')} ج</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  normalizeStatus(o.status) === 'تم التسليم' ? 'bg-green-100 text-green-700' :
                                  normalizeStatus(o.status) === 'تم الشحن'   ? 'bg-blue-100 text-blue-700' :
                                  normalizeStatus(o.status) === 'ملغي'       ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>{normalizeStatus(o.status)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
