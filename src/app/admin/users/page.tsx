'use client';

import { useEffect, useState } from 'react';
import { getAllUsers, getUserOrders, AdminUser, AdminOrder } from '@/lib/admin-storage';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => { setUsers(getAllUsers()); }, []);

  const handleSelect = (u: AdminUser) => {
    if (selected?.id === u.id) { setSelected(null); return; }
    setSelected(u);
    setOrders(getUserOrders(u.id));
  };

  const filtered = users.filter(u =>
    !search || u.name.includes(search) || u.email.includes(search) || (u.phone && u.phone.includes(search))
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">العملاء</h1>
        <p className="text-sm text-gray-500 mt-0.5">{users.length} عميل مسجل</p>
      </div>

      <input
        type="text"
        placeholder="ابحث بالاسم أو الإيميل أو الهاتف..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-72"
      />

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">👥</p>
            <p className="font-semibold">لا يوجد عملاء مسجلون بعد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-500 font-semibold">
                <th className="px-5 py-3.5 text-right">الاسم</th>
                <th className="px-5 py-3.5 text-right">البريد الإلكتروني</th>
                <th className="px-5 py-3.5 text-right">الهاتف</th>
                <th className="px-5 py-3.5 text-center">عدد الطلبات</th>
                <th className="px-5 py-3.5 text-center">عرض الطلبات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <>
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F5C518] flex items-center justify-center text-xs font-black text-[#1a1a2e] shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{u.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`font-bold ${u.orderCount > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {u.orderCount}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleSelect(u)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                          selected?.id === u.id
                            ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {selected?.id === u.id ? 'إخفاء' : 'عرض'}
                      </button>
                    </td>
                  </tr>
                  {selected?.id === u.id && (
                    <tr key={`${u.id}-orders`}>
                      <td colSpan={5} className="bg-gray-50 px-5 py-4 border-b border-gray-100">
                        {orders.length === 0 ? (
                          <p className="text-gray-400 text-sm text-center py-3">لا توجد طلبات لهذا العميل</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 mb-2">طلبات {u.name}:</p>
                            {orders.map(o => (
                              <div key={o.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm">
                                <span className="font-mono font-bold text-gray-700">#{o.id}</span>
                                <span className="text-gray-500 text-xs">{o.date}</span>
                                <span className="font-bold text-gray-900">{o.total.toLocaleString('ar-EG')} ج</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  o.status.includes('تسليم') || o.status.includes('Deliver') ? 'bg-green-100 text-green-700' :
                                  o.status.includes('شحن') || o.status.includes('Ship') ? 'bg-blue-100 text-blue-700' :
                                  o.status.includes('ملغ') || o.status.includes('Cancel') ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>{o.status}</span>
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
