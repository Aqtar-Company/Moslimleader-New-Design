'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

export default function CartPage() {
  const { items, total, updateQty, removeItem, clear } = useCart();
  const { t, isRtl } = useLang();
  const { user } = useAuth();

  const shipping = items.length > 0 ? 50 : 0;
  const currency = t('cart.currency');

  /* ── Empty ── */
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5 px-4 pt-16" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-5xl">🛒</div>
        <div className="text-center">
          <h1 className="text-xl font-black text-gray-900 mb-2">{t('cart.empty.title')}</h1>
          <p className="text-gray-400 text-sm">{t('cart.empty.desc')}</p>
        </div>
        <Link href="/" className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
          {t('cart.empty.cta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{t('cart.title')}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{items.length} {isRtl ? 'منتج' : 'items'}</p>
          </div>
          <button onClick={clear}
            className="text-sm text-gray-400 hover:text-red-500 font-semibold transition flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('cart.clearAll')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Items */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 items-center hover:border-gray-200 transition">
                {/* Image */}
                <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-50">
                  <Image src={product.images[0]} alt={product.name} fill className="object-cover" unoptimized />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm line-clamp-2 mb-1">{product.name}</p>
                  <p className="text-[#F5C518] font-black text-sm">{product.price} {currency}</p>
                </div>

                {/* Qty */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => updateQty(product.id, quantity - 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition font-bold text-base">
                    −
                  </button>
                  <span className="w-7 text-center font-black text-gray-900 text-sm">{quantity}</span>
                  <button onClick={() => updateQty(product.id, quantity + 1)}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition font-bold text-base">
                    +
                  </button>
                </div>

                {/* Total + remove */}
                <div className={`shrink-0 min-w-[72px] ${isRtl ? 'text-left' : 'text-right'}`}>
                  <p className="font-black text-gray-900 text-sm">{product.price * quantity} {currency}</p>
                  <button onClick={() => removeItem(product.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition mt-1 font-medium">
                    {t('cart.delete')}
                  </button>
                </div>
              </div>
            ))}

            {/* Continue shopping */}
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition mt-2 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
              </svg>
              {t('cart.continue')}
            </Link>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-28">
              <h2 className="font-black text-gray-900 mb-5">{t('cart.summary.title')}</h2>

              <div className="flex flex-col gap-3 text-sm">
                {/* Items breakdown */}
                <div className="space-y-2 pb-3 border-b border-gray-100">
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} className="flex justify-between text-gray-500">
                      <span className="line-clamp-1 flex-1 mr-2">{product.name} ×{quantity}</span>
                      <span className="shrink-0 font-medium text-gray-700">{product.price * quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>{t('cart.summary.subtotal')}</span>
                  <span className="font-semibold text-gray-800">{total} {currency}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>{t('cart.summary.shipping')}</span>
                  <span className="font-semibold text-gray-800">{shipping} {currency}</span>
                </div>
                <div className="flex justify-between font-black text-base pt-3 border-t border-gray-100">
                  <span className="text-gray-900">{t('cart.summary.total')}</span>
                  <span className="text-[#F5C518]">{total + shipping} {currency}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Link href="/checkout"
                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-700 transition text-sm text-center">
                  {t('cart.checkout')} →
                </Link>
                {!user && (
                  <p className="text-xs text-center text-gray-400 mt-1">
                    {isRtl ? 'يمكنك الشراء كضيف بدون تسجيل' : 'You can checkout as a guest'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
