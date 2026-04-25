'use client';

import { useEffect, useState, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useParams } from 'next/navigation';
import Image from 'next/image';

interface OrderItem {
  id: string;
  productName: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
  selectedModel?: number | null;
}

interface Order {
  id: string;
  status: string;
  total: number;
  shippingCost: number;
  discount: number;
  couponCode?: string | null;
  paymentMethod: string;
  currency: string;
  createdAt: string;
  notes?: string | null;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    street?: string;
    building?: string;
    city?: string;
    region?: string;
    governorate?: string;
    country?: string;
  };
  items: OrderItem[];
}

function getPayLabels(t: (k: string) => string): Record<string, string> {
  return {
    cod: t('invoice.pay.cod'),
    card: t('invoice.pay.card'),
    paypal: 'PayPal',
    vodafone: 'Vodafone Cash',
    instapay: 'InstaPay',
  };
}

function fmt(n: number, currency: string) {
  return `${Math.round(n * 100) / 100} ${currency}`;
}

export default function InvoicePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { t, lang } = useLang();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.order) setOrder(d.order);
        else setError(t('invoice.notfound'));
      })
      .catch(() => setError(t('invoice.error')))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{t('invoice.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-gray-700 font-semibold">{error || 'الطلب غير موجود'}</p>
        </div>
      </div>
    );
  }

  const addr = order.shippingAddress || {};
  const fullName = `${addr.firstName || ''} ${addr.lastName || ''}`.trim();
  const addressLine = [addr.street, addr.building, addr.city, addr.region, addr.governorate, addr.country]
    .filter(Boolean).join('، ');
  const orderDate = new Date(order.createdAt).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const orderNum = order.id.slice(-6).toUpperCase();
  const subtotal = order.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
          @page { margin: 15mm; size: A4; }
        }
        @media screen {
          body { background: #f3f4f6; }
        }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        <button
          onClick={handlePrint}
          className="bg-gray-900 hover:bg-gray-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          طباعة / تحميل PDF
        </button>
        <button
          onClick={() => window.close()}
          className="no-print bg-white border border-gray-200 hover:border-gray-400 text-gray-700 font-semibold px-4 py-2.5 rounded-xl shadow text-sm transition"
        >
          إغلاق
        </button>
      </div>

      {/* Invoice */}
      <div className="min-h-screen py-16 px-4 flex justify-center" dir="rtl">
        <div ref={printRef} className="print-page bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-8 py-8 text-center">
            <Image
              src="/white-Logo.webp"
              alt="Moslim Leader"
              width={140}
              height={48}
              className="h-12 w-auto mx-auto mb-4"
              unoptimized
            />
            <p className="text-[#F5C518] text-xs font-bold tracking-widest uppercase mb-1">{t('invoice.title')}</p>
            <p className="text-white text-2xl font-black font-mono">#{orderNum}</p>
          </div>

          {/* Meta strip */}
          <div className="bg-amber-50 border-b border-amber-100 px-8 py-3 flex justify-between items-center">
            <p className="text-xs text-amber-800 font-bold">📅 {orderDate}</p>
            <p className="text-xs text-amber-700">العميل: <strong>{fullName || '—'}</strong></p>
          </div>

          {/* Items */}
          <div className="px-8 py-6">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">🛒 المنتجات ({order.items.length})</p>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
              {order.items.map((item, i) => {
                const imgSrc = item.productImage
                  ? (item.productImage.startsWith('http') ? item.productImage : `https://moslimleader.com${item.productImage}`)
                  : '/white-Logo.webp';
                const lineTotal = item.unitPrice * item.quantity;
                return (
                  <div key={item.id} className={`flex items-center gap-4 px-4 py-4 ${i < order.items.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-white">
                      <Image src={imgSrc} alt={item.productName} fill className="object-cover" unoptimized />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {fmt(item.unitPrice, order.currency)} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-black text-purple-700 shrink-0">{fmt(lineTotal, order.currency)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="px-8 pb-6">
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="flex justify-between px-5 py-3 text-sm text-gray-500 border-b border-gray-100">
                <span>{t('invoice.subtotal')}</span>
                <span className="font-semibold text-gray-900">{fmt(subtotal, order.currency)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between px-5 py-3 text-sm text-green-600 border-b border-gray-100">
                  <span>خصم {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span className="font-semibold">−{fmt(order.discount, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between px-5 py-3 text-sm text-gray-500 border-b border-gray-100">
                <span>{t('invoice.shipping')}</span>
                <span className="font-semibold text-gray-900">
                  {order.shippingCost > 0 ? fmt(order.shippingCost, order.currency) : t('invoice.free')}
                </span>
              </div>
              <div className="flex justify-between px-5 py-4 bg-gray-50">
                <span className="text-base font-black text-gray-900">{t('invoice.total')}</span>
                <span className="text-xl font-black text-gray-900">{fmt(order.total, order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment + Address */}
          <div className="px-8 pb-6 grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">{t('invoice.customer')}</p>
              <p className="text-sm font-bold text-gray-900">{fullName || '—'}</p>
              {addr.phone && <p className="text-xs text-gray-500 font-mono mt-1" dir="ltr">📱 {addr.phone}</p>}
            </div>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">{t('invoice.address')}</p>
              <p className="text-xs text-gray-600 leading-relaxed">{addressLine || '—'}</p>
            </div>
          </div>

          {/* Payment method */}
          <div className="px-8 pb-6">
            <div className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-3 flex justify-between items-center">
              <span className="text-xs font-black text-gray-400 uppercase tracking-wide">{t('invoice.payment')}</span>
              <span className="text-sm font-bold text-gray-900">{getPayLabels(t)[order.paymentMethod] || order.paymentMethod}</span>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="px-8 pb-6">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
                <p className="text-xs font-black text-amber-700 mb-1">{t('invoice.notes')}</p>
                <p className="text-sm text-amber-800">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gradient-to-l from-[#1a1a2e] to-[#2d1060] px-8 py-5 text-center">
            <p className="text-white/50 text-xs mb-1">{`moslimleader.com — ${t('invoice.footer')}`}</p>
            <p className="text-[#F5C518] text-sm font-bold">{t('invoice.thanks')} 🤍</p>
          </div>

        </div>
      </div>
    </>
  );
}
