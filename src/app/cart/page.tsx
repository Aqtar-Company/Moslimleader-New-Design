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

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 pt-20" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-8xl">🛒</div>
        <h1 className="text-2xl font-bold text-gray-800">{t('cart.empty.title')}</h1>
        <p className="text-gray-500">{t('cart.empty.desc')}</p>
        <Link
          href="/"
          className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-700 transition"
        >
          {t('cart.empty.cta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900">{t('cart.title')}</h1>
          <button
            onClick={clear}
            className="text-sm text-red-500 hover:text-red-700 font-semibold transition"
          >
            {t('cart.clearAll')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Items list */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm p-4 flex gap-4 items-center">
                {/* Image */}
                <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{product.name}</p>
                  <p className="text-[#F5C518] font-bold mt-1">
                    {product.price} {currency}
                  </p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => updateQty(product.id, quantity - 1)}
                    className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-900 transition font-bold text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold text-gray-800">{quantity}</span>
                  <button
                    onClick={() => updateQty(product.id, quantity + 1)}
                    className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-900 transition font-bold text-lg leading-none"
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div className="text-right shrink-0 min-w-[70px]">
                  <p className="font-bold text-gray-900 text-sm">{product.price * quantity} {currency}</p>
                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition mt-1"
                  >
                    {t('cart.delete')}
                  </button>
                </div>
              </div>
            ))}

            <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition mt-2 inline-block">
              {t('cart.continue')}
            </Link>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-28">
              <h2 className="text-lg font-bold text-gray-900 mb-5">{t('cart.summary.title')}</h2>

              <div className="flex flex-col gap-3 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>{t('cart.summary.subtotal')}</span>
                  <span className="font-semibold text-gray-900">{total} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('cart.summary.shipping')}</span>
                  <span className="font-semibold text-gray-900">{shipping} {currency}</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-base font-black text-gray-900">
                  <span>{t('cart.summary.total')}</span>
                  <span className="text-[#F5C518]">{total + shipping} {currency}</span>
                </div>
              </div>

              {user ? (
                <button className="mt-6 w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-700 transition text-sm">
                  {t('cart.checkout')}
                </button>
              ) : (
                <div className="mt-6 flex flex-col gap-2">
                  <Link
                    href="/auth"
                    className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-700 transition text-sm text-center"
                  >
                    {isRtl ? 'سجل دخول لإتمام الشراء' : 'Sign in to Checkout'}
                  </Link>
                  <p className="text-xs text-center text-gray-400">
                    {isRtl ? 'أو تسوق كضيف' : 'or continue as guest'}
                  </p>
                  <button className="w-full border-2 border-gray-900 text-gray-900 py-3 rounded-xl font-bold hover:bg-gray-100 transition text-sm">
                    {t('cart.checkout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
