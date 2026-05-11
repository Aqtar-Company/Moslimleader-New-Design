'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { PaginationFooter } from '@/components/admin/PaginationFooter';
import { ManualOrderModal } from '@/components/admin/ManualOrderModal';
import Spinner from '@/components/admin/Spinner';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface OrderItem {
  id: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  selectedModel?: number | null;
  selectedVariantName?: string | null;
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

interface Shipment {
  id: string;
  trackingNumber: string | null;
  bostaDeliveryId: string | null;
  status: string;
  state: string | null;
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
  shipment: Shipment | null;
}

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

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
  payment_failed: 'bg-red-100 text-red-700',
};

const PAY_METHOD_LABELS: Record<string, { ar: string; icon: string }> = {
  cod: { ar: 'الدفع عند الاستلام', icon: '💵' },
  card: { ar: 'بطاقة بنكية', icon: '💳' },
  paypal: { ar: 'PayPal', icon: '🅿️' },
  vodafone: { ar: 'Vodafone Cash', icon: '📱' },
  instapay: { ar: 'InstaPay', icon: '⚡' },
  bank: { ar: 'تحويل بنكي', icon: '🏦' },
  gift: { ar: 'هدية', icon: '🎁' },
};

// Sub-filter shown only when status='paid' is active. Order matches the
// most-frequent first (PayPal/Visa) so the user reaches them quickest.
const PAYMENT_METHOD_FILTERS = ['paypal', 'card', 'bank', 'instapay', 'vodafone'] as const;

// Currency code → background tone. EGP gets a neutral chip so it doesn't
// distract; USD/SAR get a colour so PayPal/foreign orders pop visually.
const CURRENCY_CHIP: Record<string, string> = {
  EGP: 'bg-gray-100 text-gray-700',
  USD: 'bg-amber-100 text-amber-800',
  SAR: 'bg-blue-100 text-blue-800',
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] || s;
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
  const orderDate = new Date(order.createdAt).toLocaleString('en-GB', {
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
            {statusLabel(order.status)}
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
                    {(item.selectedVariantName || (item.selectedModel !== null && item.selectedModel !== undefined)) && (
                      <p className="text-[10px] text-purple-600 font-bold mt-0.5">
                        {item.selectedVariantName
                          ? `الموديل: ${item.selectedVariantName}`
                          : `موديل ${(item.selectedModel as number) + 1}`}
                      </p>
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
  const { addToast } = useToast();
  const confirm = useConfirm();
  const sp = useSearchParams();
  const highlightId = sp.get('highlight');
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [filter, setFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [forbidden, setForbidden] = useState(false);
  const [pulsedId, setPulsedId] = useState<string | null>(null);
  const highlightAppliedRef = useRef(false);

  const load = useCallback(async (limitOverride?: number) => {
    setLoading(true);
    try {
      const effectiveLimit = limitOverride ?? pageSize;
      const res = await adminFetch(`/api/admin/orders?limit=${effectiveLimit}&offset=0`);
      const data: { orders: DbOrder[]; total?: number } = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? (data.orders?.length ?? 0));
      if (limitOverride) setPageSize(limitOverride);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
    }
    setLoading(false);
  }, [pageSize]);

  useEffect(() => { load(50); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateBosta = async (order: DbOrder) => {
    if (order.shipment?.bostaDeliveryId) {
      addToast('شحنة بوسطة موجودة بالفعل', 'warning');
      return;
    }
    const ok = await confirm({
      title: 'إنشاء شحنة بوسطة',
      message: `سيتم إنشاء شحنة جديدة للطلب #${order.id.slice(-6).toUpperCase()} وإرسال البيانات إلى بوسطة.`,
      confirmLabel: 'إنشاء الشحنة',
      cancelLabel: 'إلغاء',
      icon: '📮',
    });
    if (!ok) return;
    try {
      const res = await adminFetch(`/api/admin/orders/${order.id}/bosta`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'فشل إنشاء الشحنة', 'error');
        return;
      }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, shipment: data.shipment, status: o.status === 'pending' || o.status === 'paid' ? 'shipped' : o.status } : o));
      addToast('تم إنشاء الشحنة بنجاح', 'success');
    } catch {
      addToast('فشل إنشاء الشحنة', 'error');
    }
  };

  const handleStatus = async (order: DbOrder, status: string, force = false) => {
    const previousStatus = order.status;
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));
    try {
      const res = await adminFetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, force }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Bosta cancel refused — let admin force-cancel the order anyway
        if (data.shipmentCancel?.requiresForce) {
          const goAhead = await confirm({
            title: 'بوسطة رفضت إلغاء الشحنة',
            message: `${data.shipmentCancel.error}\n\nهل تريد إلغاء الأوردر عندنا فقط (الشحنة هتفضل في طريقها للعميل)؟`,
            confirmLabel: 'إلغاء الأوردر فقط',
            cancelLabel: 'تراجع',
            tone: 'danger',
            icon: '⚠️',
          });
          if (goAhead) {
            await handleStatus(order, status, true);
          } else {
            // Roll back the optimistic update
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: previousStatus } : o));
          }
          return;
        }
        addToast(data.error || 'فشل تحديث حالة الطلب', 'error');
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: previousStatus } : o));
        return;
      }

      if (status === 'cancelled' && order.shipment?.bostaDeliveryId) {
        if (data.shipmentCancel?.ok) {
          addToast('تم إلغاء الأوردر والشحنة من بوسطة', 'success');
          setOrders(prev => prev.map(o => o.id === order.id
            ? { ...o, shipment: o.shipment ? { ...o.shipment, status: 'cancelled' } : o.shipment }
            : o));
        }
      }
    } catch {
      addToast('فشل تحديث حالة الطلب', 'error');
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: previousStatus } : o));
    }
  };

  const filtered = orders.filter(o => {
    const matchFilter =
      filter === 'all' ? true
      : filter === 'gift' ? o.paymentMethod === 'gift'
      : o.status === filter;
    // Payment-method sub-filter only applies when the main filter is 'paid';
    // it has no meaning on pending/shipped/etc. so we ignore it there.
    const matchPayMethod = filter !== 'paid' || !paymentMethodFilter || o.paymentMethod === paymentMethodFilter;
    const matchSearch = !search
      || o.id.includes(search)
      || (o.user?.name || '').includes(search)
      || (o.user?.email || '').includes(search);
    return matchFilter && matchPayMethod && matchSearch;
  });

  // Per-status counts for the filter chip badges. Computed against the
  // full loaded set, not the currently-filtered set, so they don't change
  // as the user clicks around.
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, gift: 0 };
    for (const s of STATUSES) c[s] = 0;
    for (const o of orders) {
      if (o.status in c) c[o.status]++;
      if (o.paymentMethod === 'gift') c.gift++;
    }
    return c;
  }, [orders]);

  // Per-payment-method counts among PAID orders only — feeds both the
  // sub-filter chip badges and the KPI strip.
  const paidPaymentCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orders) {
      if (o.status !== 'paid') continue;
      c[o.paymentMethod] = (c[o.paymentMethod] ?? 0) + 1;
    }
    return c;
  }, [orders]);

  // Honor `?highlight=<orderId>` from the stock-movements audit log. We
  // only run this once after the orders list lands and only if the order
  // exists in the loaded page; otherwise we can't scroll to it.
  useEffect(() => {
    if (!highlightId || highlightAppliedRef.current || orders.length === 0) return;
    const target = orders.find(o => o.id === highlightId);
    if (!target) return;
    highlightAppliedRef.current = true;
    // If the active filter would hide the target row, switch back to 'all'
    // so it's actually in the DOM.
    if (filter !== 'all' && filter !== 'gift' && target.status !== filter) {
      setFilter('all');
    }
    // Defer scroll to the next tick so the DOM has the row mounted.
    setTimeout(() => {
      const el = document.getElementById(`order-row-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setPulsedId(highlightId);
        setTimeout(() => setPulsedId(null), 2500);
      }
    }, 80);
  }, [highlightId, orders, filter]);

  // Gifts don't generate revenue — they're a marketing cost. Exclude them
  // from the revenue strip so the number reflects real money in.
  const totalRevenue = filtered
    .filter(o => o.status !== 'cancelled' && o.paymentMethod !== 'gift')
    .reduce((s, o) => s + o.total, 0);
  const giftCount = filtered.filter(o => o.paymentMethod === 'gift' && o.status !== 'cancelled').length;
  const giftCost = filtered
    .filter(o => o.paymentMethod === 'gift' && o.status !== 'cancelled')
    .reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.unitPrice * it.quantity, 0) + o.shippingCost, 0);

  if (forbidden) return <ForbiddenState requiredPerm="orders.read" />;
  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900">الطلبات</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total || orders.length} طلب إجمالاً</p>
        </div>
        <button
          onClick={() => setManualOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 transition shadow-sm"
        >
          <span>+</span> طلب يدوي (فيسبوك / واتساب / تليفون)
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="ابحث برقم الطلب أو اسم العميل..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 w-full sm:w-72"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* "تم الدفع" is given a distinct emerald style + slightly larger
              hit area because it's the most-asked-for filter; everything
              else uses the existing dark navy tone. */}
          {(['all', ...STATUSES, 'gift'] as const).map(s => {
            const isPaid = s === 'paid';
            const isActive = filter === s;
            const inactiveCls = isPaid
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              : s === 'gift'
                ? 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100'
                : 'border-gray-200 text-gray-600 hover:border-gray-400 bg-white';
            const activeCls = isPaid
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
              : s === 'gift'
                ? 'bg-pink-600 text-white border-pink-600'
                : 'bg-[#1a1a2e] text-white border-[#1a1a2e]';
            const label = s === 'all' ? '📋 الكل'
              : s === 'gift' ? '🎁 هدايا'
              : isPaid ? '💰 تم الدفع'
              : statusLabel(s);
            const count = statusCounts[s] ?? 0;
            return (
              <button
                key={s}
                onClick={() => { setFilter(s); if (s !== 'paid') setPaymentMethodFilter(''); }}
                className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition flex items-center gap-1 sm:gap-1.5 ${isActive ? activeCls : inactiveCls} ${isPaid ? 'sm:text-[13px]' : ''}`}
              >
                <span>{label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {count.toLocaleString('en-US')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Payment-method sub-filter — only renders for paid orders. */}
        {filter === 'paid' && (
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-2.5 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-emerald-700 font-bold tracking-widest pe-1">وسيلة الدفع:</span>
            <button
              onClick={() => setPaymentMethodFilter('')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${paymentMethodFilter === '' ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100'}`}
            >
              الكل ({(paidPaymentCounts && Object.values(paidPaymentCounts).reduce((s, n) => s + n, 0)).toLocaleString('en-US')})
            </button>
            {PAYMENT_METHOD_FILTERS.map(m => {
              const info = PAY_METHOD_LABELS[m];
              const count = paidPaymentCounts[m] ?? 0;
              if (count === 0) return null; // hide methods with zero paid orders
              const isActive = paymentMethodFilter === m;
              return (
                <button
                  key={m}
                  onClick={() => setPaymentMethodFilter(isActive ? '' : m)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${isActive ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100'}`}
                >
                  <span>{info.icon}</span>
                  <span>{info.ar}</span>
                  <span className={`px-1 rounded text-[10px] ${isActive ? 'bg-white/20' : 'bg-emerald-100'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>{filtered.length} طلب — إيرادات: <span className="font-bold text-gray-900">{totalRevenue.toLocaleString('en-US')} {filtered[0]?.currency || 'EGP'}</span></span>
          {giftCount > 0 && (
            <span className="text-pink-700">🎁 {giftCount} هدية — تكلفة: <span className="font-bold">{Math.round(giftCost).toLocaleString('en-US')} ج.م</span></span>
          )}
        </div>
      )}

      {/* Per-payment-method counts among paid orders. Helps the user
          eyeball "which channels brought money in this view" without
          clicking through filters. */}
      {Object.keys(paidPaymentCounts).length > 0 && (
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-emerald-700 font-bold tracking-widest pe-1">💰 المدفوع بحسب الوسيلة:</span>
          {Object.entries(paidPaymentCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([method, count]) => {
              const info = PAY_METHOD_LABELS[method] || { ar: method, icon: '💰' };
              return (
                <button
                  key={method}
                  onClick={() => { setFilter('paid'); setPaymentMethodFilter(method); }}
                  className="bg-white border border-emerald-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 hover:bg-emerald-100 transition"
                  title="اعرض الطلبات المدفوعة بهذه الوسيلة"
                >
                  <span>{info.icon}</span>
                  <span className="text-[11px] font-bold text-emerald-900">{info.ar}</span>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">{count.toLocaleString('en-US')}</span>
                </button>
              );
            })}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-3">📭</p><p className="font-semibold">لا توجد طلبات</p></div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="block lg:hidden divide-y divide-gray-100">
            {filtered.map(o => {
              const isOpen = expanded.has(o.id);
              const isPulsed = pulsedId === o.id;
              const payInfo = PAY_METHOD_LABELS[o.paymentMethod] || { ar: o.paymentMethod, icon: '💰' };
              const currencyChip = CURRENCY_CHIP[o.currency] || 'bg-gray-100 text-gray-700';
              return (
                <Fragment key={o.id}>
                  <div id={`order-row-${o.id}`} className={`p-4 space-y-2 transition ${isPulsed ? 'bg-yellow-100 ring-2 ring-yellow-400 ring-inset' : ''}`} onClick={() => toggleExpand(o.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono font-bold text-gray-900 text-sm">#{o.id.slice(-6).toUpperCase()}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{o.user?.name || 'ضيف'}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabel(o.status)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">{new Date(o.createdAt).toLocaleDateString('en-GB')} · {o.items?.length || 0} منتج</span>
                      <span className="font-bold text-gray-900 text-sm flex items-center gap-1">
                        {o.total.toLocaleString('en-US')}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${currencyChip}`}>{o.currency}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-700">
                      <span>{payInfo.icon}</span>
                      <span className="font-bold">{payInfo.ar}</span>
                      {o.paymentMethod === 'paypal' && <span className="text-[10px] text-amber-700">— تم التحصيل بالـ {o.currency}</span>}
                    </div>
                    <div className="flex gap-2 items-center pt-1" onClick={e => e.stopPropagation()}>
                      <select value={o.status} onChange={e => handleStatus(o, e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none bg-white flex-1">
                        {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                      {o.shipment?.trackingNumber && (
                        <a href={`https://bosta.co/en/track-shipment/${o.shipment.trackingNumber}`}
                          target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600">تتبع</a>
                      )}
                    </div>
                  </div>
                  {isOpen && <InvoiceDetail order={o} />}
                </Fragment>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold">
                  <th className="px-3 py-3.5 text-right w-8"></th>
                  <th className="px-5 py-3.5 text-right">رقم الطلب</th>
                  <th className="px-5 py-3.5 text-right">العميل</th>
                  <th className="px-5 py-3.5 text-right">التاريخ</th>
                  <th className="px-5 py-3.5 text-right">المبلغ</th>
                  <th className="px-5 py-3.5 text-right">وسيلة الدفع</th>
                  <th className="px-5 py-3.5 text-right">الحالة</th>
                  <th className="px-5 py-3.5 text-right">الشحن</th>
                  <th className="px-5 py-3.5 text-right">تغيير الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(o => {
                  const isOpen = expanded.has(o.id);
                  const isPulsed = pulsedId === o.id;
                  const payInfo = PAY_METHOD_LABELS[o.paymentMethod] || { ar: o.paymentMethod, icon: '💰' };
                  const currencyChip = CURRENCY_CHIP[o.currency] || 'bg-gray-100 text-gray-700';
                  return (
                    <Fragment key={o.id}>
                      <tr
                        id={`order-row-${o.id}`}
                        onClick={() => toggleExpand(o.id)}
                        className={`cursor-pointer transition ${isPulsed ? 'bg-yellow-100 ring-2 ring-yellow-400' : isOpen ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-gray-800">{o.user?.name || 'ضيف'}</p>
                            {o.paymentMethod === 'gift' && (
                              <span className="text-[10px] font-black bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-md">🎁 هدية</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{o.user?.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-gray-900">{o.total.toLocaleString('en-US')}</p>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${currencyChip}`}>{o.currency}</span>
                          {o.items?.length > 0 && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{o.items.length} منتج</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base leading-none">{payInfo.icon}</span>
                            <span className="text-xs font-bold text-gray-800">{payInfo.ar}</span>
                          </div>
                          {o.paymentMethod === 'paypal' && (
                            <p className="text-[10px] text-amber-700 mt-0.5">تم التحصيل بالـ {o.currency}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabel(o.status)}</span>
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          {o.shipment?.trackingNumber ? (
                            <div className="flex flex-col gap-0.5">
                              <a
                                href={`https://bosta.co/en/track-shipment/${o.shipment.trackingNumber}`}
                                target="_blank" rel="noreferrer"
                                className="text-xs font-mono font-bold text-blue-600 hover:underline"
                              >{o.shipment.trackingNumber}</a>
                              {o.shipment.state && (
                                <span className="text-[10px] text-gray-500">{o.shipment.state}</span>
                              )}
                              <a
                                href={`/api/admin/shipments/${o.shipment.id}/awb`}
                                target="_blank" rel="noreferrer"
                                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                                title="حمّل بوليصة الشحن من بوسطة"
                              >📄 بوليصة</a>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCreateBosta(o)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 transition"
                            >📮 شحن بوسطة</button>
                          )}
                        </td>
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <select value={o.status} onChange={e => handleStatus(o, e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gray-400 bg-white cursor-pointer">
                            {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                          </select>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={9} className="p-0">
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
          </>
        )}
      </div>

      <PaginationFooter
        shown={orders.length}
        total={total}
        loading={loading}
        onLoadMore={() => load(pageSize + 50)}
        onLoadAll={() => load(total)}
      />

      <ManualOrderModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => load(pageSize)}
      />
    </div>
  );
}
