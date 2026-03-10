'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllOrders, getAllUsers, getCoupons, getAddedProducts, getProductOverrides } from '@/lib/admin-storage';
import { products as staticProducts } from '@/lib/products';

interface Stats {
  totalOrders: number;
  confirmedRevenue: number;  // delivered only
  pendingRevenue: number;    // processing + shipped
  totalUsers: number;
  activeCoupons: number;
  outOfStock: number;
  byStatus: Record<string, number>;
  recentOrders: { id: string; userName: string; date: string; total: number; status: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  'قيد التجهيز': 'bg-amber-100 text-amber-700',
  'تم الشحن':    'bg-blue-100 text-blue-700',
  'تم التسليم':  'bg-green-100 text-green-700',
  'ملغي':        'bg-red-100 text-red-600',
};

const STATUSES = ['قيد التجهيز', 'تم الشحن', 'تم التسليم', 'ملغي'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const orders = getAllOrders();
    const users = getAllUsers();
    const coupons = getCoupons();
    const overrides = getProductOverrides();
    const addedProds = getAddedProducts();

    const allProducts = [
      ...staticProducts.map(p => ({ ...p, inStock: overrides[p.id]?.inStock ?? p.inStock })),
      ...addedProds,
    ];

    const byStatus: Record<string, number> = { 'قيد التجهيز': 0, 'تم الشحن': 0, 'تم التسليم': 0, 'ملغي': 0 };
    orders.forEach(o => { if (byStatus[o.status] !== undefined) byStatus[o.status]++; });

    // Revenue: exclude cancelled orders
    const confirmedRevenue = orders
      .filter(o => o.status === 'تم التسليم')
      .reduce((s, o) => s + o.total, 0);

    const pendingRevenue = orders
      .filter(o => o.status === 'قيد التجهيز' || o.status === 'تم الشحن')
      .reduce((s, o) => s + o.total, 0);

    setStats({
      totalOrders: orders.length,
      confirmedRevenue,
      pendingRevenue,
      totalUsers: users.length,
      activeCoupons: Object.keys(coupons).length,
      outOfStock: allProducts.filter(p => !p.inStock).length,
      byStatus,
      recentOrders: orders.slice(0, 6),
    });
  }, []);

  if (!stats) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const topCards = [
    {
      label: 'إجمالي الطلبات',
      value: stats.totalOrders,
      sub: `${stats.byStatus['ملغي']} ملغي`,
      icon: '📦',
      color: 'bg-blue-50 border-blue-200',
      link: '/admin/orders',
    },
    {
      label: 'إيرادات مؤكدة',
      value: stats.confirmedRevenue.toLocaleString('ar-EG') + ' ج',
      sub: 'طلبات تم تسليمها',
      icon: '✅',
      color: 'bg-green-50 border-green-200',
      link: '/admin/orders',
    },
    {
      label: 'إيرادات قيد التنفيذ',
      value: stats.pendingRevenue.toLocaleString('ar-EG') + ' ج',
      sub: 'تجهيز + شحن',
      icon: '🚚',
      color: 'bg-amber-50 border-amber-200',
      link: '/admin/orders',
    },
    {
      label: 'العملاء المسجلين',
      value: stats.totalUsers,
      sub: `${stats.activeCoupons} كوبون نشط`,
      icon: '👥',
      color: 'bg-purple-50 border-purple-200',
      link: '/admin/users',
    },
  ];

  const totalRevenue = stats.confirmedRevenue + stats.pendingRevenue;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">الرئيسية</h1>
        <p className="text-sm text-gray-500 mt-0.5">نظرة عامة على أداء المتجر</p>
      </div>

      {/* Out of stock alert */}
      {stats.outOfStock > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold text-red-700 text-sm">{stats.outOfStock} منتج نفذ من المخزن</p>
            <p className="text-red-500 text-xs mt-0.5">تحقق من صفحة المنتجات وقم بتحديث المخزون</p>
          </div>
          <Link href="/admin/products" className="text-xs font-bold text-red-600 underline shrink-0">عرض</Link>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map(c => (
          <Link key={c.label} href={c.link} className={`${c.color} border rounded-2xl p-4 hover:shadow-md transition block`}>
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="text-xl font-black text-gray-900 leading-tight">{c.value}</div>
            <div className="text-xs font-semibold text-gray-600 mt-1">{c.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
          </Link>
        ))}
      </div>

      {/* Orders status breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-sm">توزيع الطلبات بالحالة</h2>
          <span className="text-xs text-gray-400">إجمالي الإيرادات (غير الملغية): <span className="font-bold text-gray-700">{totalRevenue.toLocaleString('ar-EG')} ج.م</span></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUSES.map(s => (
            <Link
              key={s}
              href={`/admin/orders`}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition text-center gap-1"
            >
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[s]}`}>{s}</span>
              <span className="text-2xl font-black text-gray-900">{stats.byStatus[s] ?? 0}</span>
              <span className="text-xs text-gray-400">طلب</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent orders */}
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
                    <td className="px-5 py-3 font-mono font-bold text-gray-900">#{o.id}</td>
                    <td className="px-5 py-3 text-gray-700">{o.userName || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{o.date}</td>
                    <td className={`px-5 py-3 font-semibold ${o.status === 'ملغي' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {o.total.toLocaleString('ar-EG')} ج
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {o.status}
                      </span>
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
