'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import Image from 'next/image';

interface OrderItem {
  id: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  selectedModel?: number | null;
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  phone?: string;
  whatsappNumber?: string;
  street?: string;
  building?: string;
  city?: string;
  region?: string;
  governorate?: string;
  country?: string;
  notes?: string;
}

interface DbOrder {
  id: string;
  status: string;
  total: number;
  shippingCost: number;
  discount: number;
  couponCode: string | null;
  paymentMethod: string;
  paypalOrderId: string | null;
  shippingAddress: ShippingAddress;
  notes: string | null;
  currency: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  items: OrderItem[];
}

const STATUSES = ['قيد التجهيز', 'تم الشحن', 'تم التسليم', 'ملغي'];

const STATUS_COLORS: Record<string, string> = {
  'قيد التجهيز': 'bg-amber-100 text-amber-700',
  'تم الشحن':    'bg-blue-100 text-blue-700',
  'تم التسليم':  'bg-green-100 text-green-700',
  'ملغي':        'bg-red-100 text-red-700',
  'pending':     'bg-amber-100 text-amber-700',
  'paid':        'bg-emerald-100 text-emerald-700',
};

const PAY_METHOD_LABELS: Record<string, { ar: string; icon: string }> = {
  cod: { ar: 'الدفع عند الاستلام', icon: '💵' },
  card: { ar: 'بطاقة بنكية', icon: '💳' },
  paypal: { ar: 'PayPal', icon: '🅿️' },
  vodafone: { ar: 'Vodafone Cash', icon: '📱' },
  instapay: { ar: 'InstaPay', icon: '⚡' },
};

function normalizeStatus(s: string): string {
  if (s === 'pending' || s === 'processing') return 'قيد التجهيز';
  if (s === 'paid') return 'قيد التجهيز';
  if (s === 'shipped') return 'تم الشحن';
  if (s === 'delivered') return 'تم التسليم';
  if (s === 'cancelled') return 'ملغي';
  return s;
}

function formatPrice(n: number, currency: string) {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded.toLocaleString('en-US')} ${currency}`;
}

function buildAddressLine(addr: ShippingAddress): string {
  return [addr.street, addr.building, addr.city, addr.region, addr.governorate, addr.country]
    .filter(Boolean)
    .join('، ');
}

/* ───────── Expanded Invoice Detail Row ───────── */
function InvoiceDetail({ order }: { order: DbOrder }) {
  const subtotal = order.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const payInfo = PAY_METHOD_LABELS[order.paymentMethod] || { ar: order.paymentMethod, icon: '💰' };
  const fullName = `${order.shippingAddress?.firstName ?? ''} ${order.shippingAddress?.lastName ?? ''}`.trim() || order.user?.name || 'ضيف';
  const orderDate = new Date(order.createdAt).toLocaleString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white border-t-2 border-[#F5C518] px-2 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100">

        {/* Brand header */}
        <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-2">
              <Image src="/white-Logo.webp" alt="Moslim Leader" width={100} height={32} className="h-8 w-auto" unoptimized />
            </div>
          </div>
          <div className="text-left">
            <p className="text-[#F5C518] text-[10px] font-bold tracking-widest uppercase">فاتورة الطلب</p>
            <p className="text-white/70 text-xs mt-0.5 font-mono">#{order.id.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        {/* Order meta strip */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📅</span>
            <p className="text-xs text-gray-700 font-semibold">{orderDate}</p>
          </div>
          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
            {order.status}
          </span>
        </div>

        {/* Items list */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">🛒 المنتجات ({order.items.length})</h3>
          </div>

          <div className="space-y-3">
            {order.items.map(item => {
              const lineTotal = item.unitPrice * item.quantity;
              return (
                <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition border border-gray-100">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white border border-gray-200 shrink-0">
                    {item.productImage ? (
                      <Image src={item.productImage} alt={item.productName} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm leading-snug truncate">{item.productName}</p>
                    {item.selectedModel !== null && item.selectedModel !== undefined && (
                      <p className="text-[10px] text-purple-600 font-bold mt-0.5">موديل {item.selectedModel}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-gray-500 font-mono">{formatPrice(item.unitPrice, order.currency)}</span>
                      <span className="text-gray-300">×</span>
                      <span className="text-[11px] font-bold text-gray-700">{item.quantity}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-base font-black text-[#6B21A8]">{formatPrice(lineTotal, order.currency)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">المجموع الفرعي</span>
            <span className="font-bold text-gray-900">{formatPrice(subtotal, order.currency)}</span>
          </div>

          {order.discount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-700 flex items-center gap-1.5">
                <span>🎟️</span>
                <span className="font-semibold">خصم</span>
                {order.couponCode && (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide font-mono">
                    {order.couponCode}
                  </span>
                )}
              </span>
              <span className="font-bold text-green-700">−{formatPrice(order.discount, order.currency)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 flex items-center gap-1.5">
              <span>🚚</span>
              <span>الشحن</span>
            </span>
            <span className="font-bold text-gray-900">
              {order.shippingCost > 0 ? formatPrice(order.shippingCost, order.currency) : (
                <span className="text-green-700">مجاني</span>
              )}
            </span>
          </div>

          <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
            <span className="font-black text-gray-900 text-base">الإجمالي</span>
            <span className="font-black text-2xl text-[#1a1a2e]">{formatPrice(order.total, order.currency)}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-200">
            <span className="text-xs text-gray-500">وسيلة الدفع</span>
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>{payInfo.icon}</span>
              {payInfo.ar}
            </span>
          </div>
          {order.paypalOrderId && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-400">PayPal Order ID</span>
              <span className="text-[10px] font-mono text-gray-500">{order.paypalOrderId.slice(0, 14)}…</span>
            </div>
          )}
        </div>

        {/* Customer + Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 py-5 bg-white border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">👤 العميل</p>
            <p className="font-bold text-gray-900 text-sm">{fullName}</p>
            <p className="text-xs text-gray-500 mt-1 break-all">{order.user?.email}</p>
            {order.shippingAddress?.phone && (
              <p className="text-xs text-gray-600 mt-1 font-mono" dir="ltr">📱 {order.shippingAddress.phone}</p>
            )}
            {order.shippingAddress?.whatsappNumber && order.shippingAddress.whatsappNumber !== order.shippingAddress.phone && (
              <p className="text-xs text-green-600 mt-1 font-mono" dir="ltr">💬 {order.shippingAddress.whatsappNumber}</p>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">📍 عنوان الشحن</p>
            <p className="text-xs text-gray-700 leading-relaxed">{buildAddressLine(order.shippingAddress) || '—'}</p>
          </div>
        </div>

        {order.notes && (
          <div className="px-6 pb-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">📝 ملاحظات العميل</p>
              <p className="text-xs text-amber-900 leading-relaxed">{order.notes}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-6 py-3 flex items-center justify-between">
          <p className="text-white/40 text-[10px]">moslimleader.com</p>
          <p className="text-[#F5C518]/90 text-[10px] font-bold">جزاك الله خيرًا 🤍</p>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders', { credentials: 'include', cache: 'no-store' });
      const { orders: raw }: { orders: DbOrder[] } = await res.json();
      setOrders((raw ?? []).map(o => ({ ...o, status: normalizeStatus(o.status) })));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatus = async (order: DbOrder, status: string) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));
    await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
  };

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter;
    const matchSearch = !search
      || o.id.includes(search)
      || (o.user?.name || '').includes(search)
      || (o.user?.email || '').includes(search);
    return matchFilter && matchSearch;
  });

  const totalRevenue = filtered.filter(o => o.status !== 'ملغي').reduce((s, o) => s + o.total, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">الطلبات</h1>
        <p className="text-sm text-gray-500 mt-0.5">{orders.length} طلب إجمالاً</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="ابحث برقم الطلب أو اسم العميل..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-72"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === s ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {s === 'all' ? 'الكل' : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="text-sm text-gray-500">
          {filtered.length} طلب — إجمالي: <span className="font-bold text-gray-900">{totalRevenue.toLocaleString('en-US')} {filtered[0]?.currency || 'EGP'}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-3">📭</p><p className="font-semibold">لا توجد طلبات</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold">
                  <th className="px-3 py-3.5 text-right w-8"></th>
                  <th className="px-5 py-3.5 text-right">رقم الطلب</th>
                  <th className="px-5 py-3.5 text-right">العميل</th>
                  <th className="px-5 py-3.5 text-right">التاريخ</th>
                  <th className="px-5 py-3.5 text-right">المبلغ</th>
                  <th className="px-5 py-3.5 text-right">الحالة</th>
                  <th className="px-5 py-3.5 text-right">تغيير الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(o => {
                  const isOpen = expanded.has(o.id);
                  return (
                    <Fragment key={o.id}>
                      <tr
                        onClick={() => toggleExpand(o.id)}
                        className={`cursor-pointer transition ${isOpen ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-3 py-3.5 text-center">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform mx-auto ${isOpen ? 'rotate-180 bg-[#F5C518] text-[#1a1a2e]' : 'bg-gray-100 text-gray-500'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-gray-900">#{o.id.slice(-6).toUpperCase()}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-gray-800">{o.user?.name || 'ضيف'}</p>
                          <p className="text-xs text-gray-400">{o.user?.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-gray-900">{o.total.toLocaleString('en-US')} <span className="text-[10px] text-gray-400">{o.currency}</span></p>
                          {o.items?.length > 0 && (
                            <p className="text-[10px] text-gray-400">{o.items.length} منتج</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <select value={o.status} onChange={e => handleStatus(o, e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gray-400 bg-white cursor-pointer">
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <InvoiceDetail order={o} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
