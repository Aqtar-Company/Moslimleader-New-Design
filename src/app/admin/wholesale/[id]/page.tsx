'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';
import ReceivablesPanel from './ReceivablesPanel';

interface ProductRow {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  lastPurchaseAt: string;
}

interface OrderRow {
  id: string;
  total: number;
  status: string;
  paymentMethod: string;
  currency: string;
  createdAt: string;
  itemCount: number;
  itemsSummary: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isWholesale: boolean;
  createdAt: string;
}

interface Summary {
  orderCount: number;
  totalSpend: number;
  totalUnits: number;
  uniqueProducts: number;
  balance: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => `${fmt(n)} ج.م`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB');

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending:    { label: 'قيد التجهيز', tone: 'bg-amber-100 text-amber-700' },
  paid:       { label: 'تم الدفع',    tone: 'bg-emerald-100 text-emerald-700' },
  shipped:    { label: 'تم الشحن',    tone: 'bg-blue-100 text-blue-700' },
  delivered:  { label: 'تم التسليم',  tone: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'ملغي',         tone: 'bg-red-100 text-red-700' },
};

export default function WholesaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserData | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/wholesale/${id}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        setUser(data.user);
        setProducts(data.products);
        setOrders(data.orders);
        setSummary(data.summary);
      } catch (err) {
        if (err instanceof ForbiddenError) setForbidden(true);
      }
      setLoading(false);
    })();
  }, [id]);

  if (forbidden) return <ForbiddenState requiredPerm="wholesale.read" />;
  if (loading) return <Spinner />;
  if (!user || !summary) return <EmptyState message="التاجر غير موجود" icon="🏪" />;

  const owesUs = summary.balance > 0;
  const overpaid = summary.balance < 0;

  return (
    <div className="space-y-5" dir="rtl">
      <Link href="/admin/wholesale" className="text-xs text-gray-500 hover:text-gray-900">← العودة لقائمة تجار الجملة</Link>

      {/* Header */}
      <div className="bg-gradient-to-l from-blue-700 via-indigo-700 to-[#1a1a2e] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black">{user.name}</h1>
            <p className="text-white/70 text-sm mt-1" dir="ltr">{user.email}</p>
            {user.phone && <p className="text-white/60 text-sm font-mono mt-0.5" dir="ltr">{user.phone}</p>}
            <p className="text-white/40 text-[11px] mt-2">عميل منذ {fmtDate(user.createdAt)}</p>
          </div>
          <div className="text-left">
            <p className="text-[10px] text-[#F5C518] font-bold tracking-widest">الرصيد الحالي</p>
            <p className={`text-3xl font-black mt-1 ${summary.balance === 0 ? 'text-white' : owesUs ? 'text-red-300' : 'text-emerald-300'}`} dir="ltr">
              {fmtMoney(Math.abs(summary.balance))}
            </p>
            <p className="text-white/60 text-xs mt-1">
              {owesUs ? 'يدين لنا' : overpaid ? 'دفع زيادة (مستحق رد)' : 'الحساب مسوّى'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="عدد الطلبات" value={fmt(summary.orderCount)} />
        <KPI label="إجمالي المبيعات" value={fmtMoney(summary.totalSpend)} />
        <KPI label="إجمالي القطع" value={fmt(summary.totalUnits)} />
        <KPI label="منتجات مختلفة" value={fmt(summary.uniqueProducts)} />
      </div>

      {/* Products purchased */}
      <section className="space-y-2">
        <h2 className="text-base font-black text-gray-900">📦 المنتجات اللي اشتراها</h2>
        {products.length === 0 ? (
          <EmptyState message="ما عندوش طلبات لسه" icon="📦" />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-right">المنتج</th>
                    <th className="px-3 py-2.5 text-right">الكمية</th>
                    <th className="px-3 py-2.5 text-right">عدد الطلبات</th>
                    <th className="px-3 py-2.5 text-right">إجمالي الإيراد</th>
                    <th className="px-3 py-2.5 text-right">آخر شراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map(p => (
                    <tr key={p.productId} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-bold text-gray-900">{p.productName}</td>
                      <td className="px-3 py-2.5 font-black text-blue-700">{fmt(p.totalQuantity)}</td>
                      <td className="px-3 py-2.5 text-gray-600">{fmt(p.orderCount)}</td>
                      <td className="px-3 py-2.5 font-bold" dir="ltr">{fmtMoney(p.totalRevenue)}</td>
                      <td className="px-3 py-2.5 text-[10px] font-mono text-gray-500" dir="ltr">{fmtDate(p.lastPurchaseAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Financial ledger */}
      <ReceivablesPanel customerId={user.id} />

      {/* Orders */}
      <section className="space-y-2">
        <h2 className="text-base font-black text-gray-900">📋 الطلبات (آخر {fmt(orders.length)})</h2>
        {orders.length === 0 ? (
          <EmptyState message="مفيش طلبات" icon="📋" />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 font-bold uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-right">الطلب</th>
                    <th className="px-3 py-2.5 text-right">التاريخ</th>
                    <th className="px-3 py-2.5 text-right">العناصر</th>
                    <th className="px-3 py-2.5 text-right">المبلغ</th>
                    <th className="px-3 py-2.5 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => {
                    const stat = STATUS_LABELS[o.status] ?? { label: o.status, tone: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          <Link href={`/admin/orders?highlight=${o.id}`} className="text-blue-700 hover:underline font-bold">
                            #{o.id.slice(-6).toUpperCase()}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] font-mono text-gray-600" dir="ltr">{fmtDate(o.createdAt)}</td>
                        <td className="px-3 py-2.5 text-[11px] text-gray-700 max-w-[280px] truncate" title={o.itemsSummary}>
                          {o.itemCount} منتج · {o.itemsSummary}
                        </td>
                        <td className="px-3 py-2.5 font-bold" dir="ltr">{fmt(o.total)} {o.currency}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${stat.tone}`}>{stat.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 font-bold tracking-widest">{label}</p>
      <p className="text-2xl font-black mt-1 text-gray-900">{value}</p>
    </div>
  );
}
