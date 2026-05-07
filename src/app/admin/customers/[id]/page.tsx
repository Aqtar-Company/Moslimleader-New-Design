'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/components/ui/Toast';
import { toIntlPhone } from '@/lib/phone';
import Spinner from '@/components/admin/Spinner';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface ProductImage { url?: string; src?: string }

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  lastGovernorate: string | null;
  lastAddr: { street?: string; building?: string; city?: string; region?: string; governorate?: string; country?: string } | null;
}

interface Metrics {
  totalSpend: number;
  orderCount: number;
  avgOrder: number;
  lastOrderAt: string | null;
  daysSinceLast: number | null;
  productsBought: number;
  productsTotal: number;
}

interface BoughtProduct { productId: string; name: string; quantity: number; spend: number; lastBoughtAt: string }

interface NotBoughtProduct { id: string; name: string; slug: string; price: number; images: ProductImage[] | unknown }

interface OrderRow {
  id: string; status: string; total: number; currency: string; paymentMethod: string;
  createdAt: string; itemCount: number; tracking: string | null; shipmentStatus: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد التجهيز',
  paid: 'تم الدفع',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  payment_failed: 'فشل الدفع',
};

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-amber-100 text-amber-700',
  paid:        'bg-emerald-100 text-emerald-700',
  shipped:     'bg-blue-100 text-blue-700',
  delivered:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
};

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (typeof first === 'string') return first;
  if (typeof first === 'object' && first !== null) {
    const obj = first as { url?: string; src?: string };
    return obj.url || obj.src || null;
  }
  return null;
}

function formatPrice(n: number) {
  return Math.round(n).toLocaleString('ar-EG');
}

function timeAgoAr(iso: string | null): string {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 30) return `من ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `من ${months} شهر`;
  return `من ${Math.floor(months / 12)} سنة`;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [bought, setBought] = useState<BoughtProduct[]>([]);
  const [notBought, setNotBought] = useState<NotBoughtProduct[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [waMessage, setWaMessage] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/customers/${id}`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setCustomer(data.customer);
      setMetrics(data.metrics);
      setBought(data.bought);
      setNotBought(data.notBought);
      setOrders(data.orders);
      const firstName = (data.customer.name as string).split(' ')[0];
      setWaMessage(`مرحبًا ${firstName} 👋\nمن Moslim Leader.\n\nعندنا منتج جديد ممكن يعجبك، تحب أبعتلك التفاصيل؟`);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل تحميل بيانات العميل', 'error');
    }
    setLoading(false);
  }, [id, addToast]);

  useEffect(() => { load(); }, [load]);

  if (forbidden) return <ForbiddenState requiredPerm="customers.read" />;
  if (loading) return <Spinner />;
  if (!customer || !metrics) return <div className="text-center text-gray-400 py-16">العميل غير موجود</div>;

  const intl = toIntlPhone(customer.phone);
  const waLink = intl ? `https://wa.me/${intl}?text=${encodeURIComponent(waMessage)}` : null;

  const purchaseRatio = metrics.productsTotal > 0
    ? Math.round((metrics.productsBought / metrics.productsTotal) * 100)
    : 0;

  const isVIP = metrics.totalSpend > 5000;
  const isDormant = (metrics.daysSinceLast ?? 0) > 90;

  return (
    <div className="space-y-5">
      <Link href="/admin/customers" className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
        ← العودة لقاعدة العملاء
      </Link>

      {/* Header card */}
      <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#F5C518] flex items-center justify-center text-2xl font-black text-[#1a1a2e]">
              {customer.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black">{customer.name}</h1>
              <p className="text-white/70 text-sm mt-1">{customer.email}</p>
              {customer.phone && <p className="text-white/60 text-sm font-mono mt-0.5" dir="ltr">{customer.phone}</p>}
              {customer.lastGovernorate && (
                <p className="text-[#F5C518] text-xs font-semibold mt-1">📍 {customer.lastGovernorate}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isVIP && <span className="bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs font-bold px-2.5 py-1 rounded-full">👑 VIP</span>}
            {isDormant && <span className="bg-rose-500/20 text-rose-200 border border-rose-400/30 text-xs font-bold px-2.5 py-1 rounded-full">💤 نائم</span>}
            {!isDormant && metrics.orderCount >= 2 && <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-bold px-2.5 py-1 rounded-full">🔁 متكرر</span>}
            {metrics.orderCount === 1 && <span className="bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-bold px-2.5 py-1 rounded-full">🆕 مرة واحدة</span>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon="💰" label="إجمالي المشتريات" value={`${formatPrice(metrics.totalSpend)} ج.م`} />
        <KPI icon="📦" label="عدد الطلبات" value={String(metrics.orderCount)} />
        <KPI icon="🎯" label="متوسط الطلب" value={`${formatPrice(metrics.avgOrder)} ج.م`} />
        <KPI icon="📅" label="آخر طلب" value={timeAgoAr(metrics.lastOrderAt)} />
      </div>

      {/* Reach actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2"><span>📨</span> تواصل سريع</h2>
        <div className="space-y-3">
          <textarea
            value={waMessage}
            onChange={e => setWaMessage(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 resize-none"
            placeholder="اكتب رسالة..."
          />
          <div className="flex flex-wrap gap-2">
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 transition"
              >📱 افتح واتساب</a>
            ) : (
              <span className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-400 text-sm font-bold">📱 لا يوجد رقم صالح</span>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}?body=${encodeURIComponent(waMessage)}`}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-2 transition"
              >📧 إيميل</a>
            )}
          </div>
        </div>
      </div>

      {/* Product breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-gray-900">🛒 منتجات اشتراها ({bought.length})</h2>
            <span className="text-xs text-gray-500">{purchaseRatio}% من الكتالوج</span>
          </div>
          {bought.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">لم يشترِ أي منتج بعد</p>
          ) : (
            <div className="space-y-2">
              {bought.map(p => (
                <div key={p.productId} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-500">{p.quantity} قطعة · آخر شراء {timeAgoAr(p.lastBoughtAt)}</p>
                  </div>
                  <span className="text-xs font-black text-[#6B21A8] shrink-0">{formatPrice(p.spend)} ج.م</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-black text-gray-900 mb-3">🎯 منتجات لم يشترِها ({notBought.length})</h2>
          {notBought.length === 0 ? (
            <p className="text-xs text-emerald-600 font-bold py-6 text-center">✨ اشترى كل المنتجات!</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {notBought.map(p => {
                const img = firstImage(p.images);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {img ? (
                        <Image src={img} alt={p.name} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-base">📦</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-500">{formatPrice(p.price)} ج.م</p>
                    </div>
                    <button
                      onClick={() => {
                        const url = `https://moslimleader.com/shop/${p.slug}`;
                        setWaMessage(`مرحبًا ${customer.name.split(' ')[0]} 👋\nشوف منتجنا "${p.name}" — ممكن يعجبك جدًا.\n${url}`);
                      }}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                      title="رشّح هذا المنتج مع اللينك"
                    >رشح</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Orders list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-black text-gray-900 mb-3">📋 سجل الطلبات ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">لا توجد طلبات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 font-semibold border-b border-gray-100">
                  <th className="px-3 py-2.5 text-right">رقم الطلب</th>
                  <th className="px-3 py-2.5 text-right">التاريخ</th>
                  <th className="px-3 py-2.5 text-right">منتجات</th>
                  <th className="px-3 py-2.5 text-right">الإجمالي</th>
                  <th className="px-3 py-2.5 text-right">الحالة</th>
                  <th className="px-3 py-2.5 text-right">التتبع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono font-bold text-gray-900">#{o.id.slice(-6).toUpperCase()}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td className="px-3 py-2.5 text-xs">{o.itemCount}</td>
                    <td className="px-3 py-2.5 font-bold">{formatPrice(o.total)} <span className="text-[10px] text-gray-400">{o.currency}</span></td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {o.tracking ? (
                        <a
                          href={`https://bosta.co/en/track-shipment/${o.tracking}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-blue-600 hover:underline"
                        >{o.tracking}</a>
                      ) : <span className="text-[11px] text-gray-300">—</span>}
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

function KPI({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <p className="text-xl mb-1">{icon}</p>
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-lg font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}
