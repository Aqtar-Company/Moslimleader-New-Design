'use client';

import { useEffect, useState, useCallback } from 'react';
import { PaginationFooter } from '@/components/admin/PaginationFooter';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { adminFetch, adminJson, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';
import Spinner from '@/components/admin/Spinner';

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
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<DbUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<Record<string, DbOrder[]>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const load = useCallback(async (limitOverride?: number) => {
    setLoading(true);
    try {
      const effectiveLimit = limitOverride ?? pageSize;
      const params = new URLSearchParams({ limit: String(effectiveLimit), offset: '0' });
      if (search.trim()) params.set('q', search.trim());
      const res = await adminFetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? (data.users?.length ?? 0));
      if (limitOverride) setPageSize(limitOverride);
      setForbidden(false);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل تحميل المستخدمين', 'error');
    }
    setLoading(false);
  }, [pageSize, search, addToast]);

  useEffect(() => {
    setPageSize(50);
    const t = setTimeout(() => load(50), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSelect = async (u: DbUser) => {
    if (selectedId === u.id) { setSelectedId(null); return; }
    setSelectedId(u.id);
    if (!userOrders[u.id]) {
      try {
        const res = await fetch(`/api/admin/customers/${u.id}`, { credentials: 'include' });
        const data = await res.json();
        const orders = (data.orders ?? []) as DbOrder[];
        setUserOrders(prev => ({ ...prev, [u.id]: orders }));
      } catch {
        setUserOrders(prev => ({ ...prev, [u.id]: [] }));
      }
    }
  };

  // Server already filters by `q`; this is a no-op kept for back-compat.
  const filtered = users;

  if (forbidden) return <ForbiddenState message="إدارة المستخدمين متاحة للأدمن الرئيسي فقط" />;
  if (loading) return <Spinner />;

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
                        disabled={resettingId === u.id}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'إعادة تعيين الأجهزة',
                            message: `إعادة تعيين أجهزة ${u.name}؟ هتلغي كل الأجهزة المسجّلة وهيحتاج يسجّل دخول من جديد على كل جهاز.`,
                            confirmLabel: 'إعادة تعيين',
                            cancelLabel: 'تراجع',
                            tone: 'danger',
                            icon: '🔌',
                          });
                          if (!ok) return;
                          setResettingId(u.id);
                          try {
                            await adminJson(`/api/admin/devices?userId=${u.id}`, { method: 'DELETE' });
                            addToast('تم إعادة تعيين الأجهزة بنجاح', 'success');
                          } catch (err) {
                            addToast(err instanceof Error ? err.message : 'فشل إعادة التعيين', 'error');
                          } finally {
                            setResettingId(null);
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

      <PaginationFooter
        shown={users.length}
        total={total}
        loading={loading}
        onLoadMore={() => load(pageSize + 50)}
        onLoadAll={() => load(total)}
      />
    </div>
  );
}
