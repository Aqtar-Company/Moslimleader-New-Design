'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import RecentStaffActivity from './RecentStaffActivity';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { STATUS_COLORS, STATUSES } from '@/lib/admin-status';
import Spinner from '@/components/admin/Spinner';
import StatusPill from '@/components/admin/StatusPill';

interface RecentOrder {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  userName: string;
}

interface DashboardData {
  totalOrders: number;
  totalRevenue: number;
  confirmedRevenue: number;
  pendingRevenue: number;
  customersCount: number | null;
  activeCouponsCount: number | null;
  outOfStockCount: number | null;
  byStatus: Record<string, number>;
  recentOrders: RecentOrder[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const [stats, setStats] = useState<DashboardData | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    adminFetch('/api/admin/dashboard', { signal: ac.signal })
      .then(r => r.json())
      .then(d => { if (!ac.signal.aborted && d && !d.error) setStats(d); })
      .catch(() => {/* ignore — page just stays in loading state */});
    return () => ac.abort();
  }, []);

  if (!stats) return <Spinner />;

  const fmt = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US');
  const fmtMoney = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US') + ' ج.م';

  const topCards: Array<{ label: string; value: string; sub: string; icon: string; color: string; link: string }> = [
    { label: 'إجمالي الطلبات',     value: fmt(stats.totalOrders), sub: `${stats.byStatus['ملغي'] ?? 0} ملغي`, icon: '📦', color: 'bg-blue-50 border-blue-200',   link: '/admin/orders' },
    { label: 'إيرادات مؤكدة',      value: fmtMoney(stats.confirmedRevenue), sub: 'طلبات تم تسليمها', icon: '✅', color: 'bg-green-50 border-green-200', link: '/admin/orders' },
    { label: 'إيرادات قيد التنفيذ', value: fmtMoney(stats.pendingRevenue),   sub: 'تجهيز + شحن',      icon: '🚚', color: 'bg-amber-50 border-amber-200', link: '/admin/orders' },
  ];
  if (stats.customersCount !== null) {
    topCards.push({
      label: 'العملاء المسجلين', value: fmt(stats.customersCount),
      sub: stats.activeCouponsCount !== null ? `${stats.activeCouponsCount} كوبون نشط` : '—',
      icon: '👥', color: 'bg-purple-50 border-purple-200', link: '/admin/users',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">الرئيسية</h1>
        <p className="text-sm text-gray-500 mt-0.5">نظرة عامة على أداء المتجر</p>
      </div>

      {(stats.outOfStockCount ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold text-red-700 text-sm">{stats.outOfStockCount} منتج نفذ من المخزن</p>
            <p className="text-red-500 text-xs mt-0.5">تحقق من صفحة المنتجات وقم بتحديث المخزون</p>
          </div>
          <Link href="/admin/products" className="text-xs font-bold text-red-600 underline shrink-0">عرض</Link>
        </div>
      )}

      <div className={`grid grid-cols-2 ${topCards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {topCards.map(c => (
          <Link key={c.label} href={c.link} className={`${c.color} border rounded-2xl p-4 hover:shadow-md transition block`}>
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="text-base sm:text-xl font-black text-gray-900 leading-tight truncate">{c.value}</div>
            <div className="text-xs font-semibold text-gray-600 mt-1">{c.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-sm">توزيع الطلبات بالحالة</h2>
          <span className="text-xs text-gray-400">إجمالي الإيرادات: <span className="font-bold text-gray-700">{stats.totalRevenue.toLocaleString('en-US')} ج.م</span></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUSES.map(s => (
            <Link key={s} href="/admin/orders" className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition text-center gap-1">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[s]}`}>{s}</span>
              <span className="text-2xl font-black text-gray-900">{stats.byStatus[s] ?? 0}</span>
              <span className="text-xs text-gray-400">طلب</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">آخر الطلبات</h2>
          <Link href="/admin/orders" className="text-xs text-[#1a1a2e] font-semibold hover:underline">عرض الكل</Link>
        </div>
        {stats.recentOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">لا توجد طلبات بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-5 py-3 text-right font-semibold">رقم الطلب</th>
                  <th className="px-5 py-3 text-right font-semibold">العميل</th>
                  <th className="px-5 py-3 text-right font-semibold">التاريخ</th>
                  <th className="px-5 py-3 text-right font-semibold">المبلغ</th>
                  <th className="px-5 py-3 text-right font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentOrders.map(o => (
                  <tr key={o.id} className={`hover:bg-gray-50 transition ${o.status === 'ملغي' ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 font-mono font-bold text-gray-900">#{o.id.slice(-6)}</td>
                    <td className="px-5 py-3 text-gray-700">{o.userName}</td>
                    <td className="px-5 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className={`px-5 py-3 font-semibold ${o.status === 'ملغي' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{o.total.toLocaleString('en-US')} ج.م</td>
                    <td className="px-5 py-3">
                      <StatusPill status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isSuperAdmin && <RecentStaffActivity />}
    </div>
  );
}
