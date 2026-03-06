'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';

export default function CartPage() {
  const { items, total, updateQty, removeItem, clear } = useCart();
  const { t, isRtl } = useLang();

  if (items.length === 0) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-7xl mb-6">🛒</div>
        <h1 className="text-2xl font-black text-gray-900 mb-3">{t('cart.empty.title')}</h1>
        <p className="text-gray-500 mb-8">{t('cart.empty.desc')}</p>
        <Link
          href="/shop"
          className="inline-block bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-bold px-8 py-3 rounded-xl transition"
        >
          {t('cart.empty.cta')}
        </Link>
      </div>
    );
  }

  const shipping = 80;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black text-gray-900 mb-8">{t('cart.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {items.map(item => (
            <div key={item.product.id} className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              {/* Image */}
              <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-gray-50">
                <Image
                  src={item.product.images[0]}
                  alt={item.product.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* Details */}
              <div className="flex-1 flex flex-col gap-1">
                <Link href={`/shop/${item.product.slug}`} className="font-bold text-gray-900 hover:text-purple-700 transition text-sm leading-snug">
                  {isRtl ? item.product.name : (item.product.nameEn || item.product.name)}
                </Link>
                <span className="text-gray-500 text-xs">{item.product.category}</span>
                <span className="font-bold text-gray-900">{item.product.price} {t('cart.currency')}</span>

                <div className="flex items-center gap-3 mt-auto">
                  {/* Qty */}
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQty(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition font-bold"
                    >−</button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition font-bold"
                    >+</button>
                  </div>

                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="text-red-400 hover:text-red-600 text-xs transition"
                  >
                    {t('cart.delete')}
                  </button>
                </div>
              </div>

              {/* Line total */}
              <div className="shrink-0 text-left font-black text-gray-900">
                {item.product.price * item.quantity} {t('cart.currency')}
              </div>
            </div>
          ))}

          <button
            onClick={clear}
            className="text-sm text-gray-400 hover:text-red-500 transition self-end mt-2"
          >
            {t('cart.clearAll')}
          </button>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-2xl p-6 sticky top-24">
            <h2 className="text-xl font-black text-gray-900 mb-5">{t('cart.summary.title')}</h2>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('cart.summary.subtotal')}</span>
                <span className="font-bold">{total} {t('cart.currency')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('cart.summary.shipping')}</span>
                <span className="font-bold">{shipping} {t('cart.currency')}</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-base">
                <span className="font-black text-gray-900">{t('cart.summary.total')}</span>
                <span className="font-black text-gray-900 text-lg">{total + shipping} {t('cart.currency')}</span>
              </div>
            </div>

            <Link href="/checkout" className="mt-6 block w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 rounded-xl transition text-lg text-center">
              {t('cart.checkout')}
            </Link>
            <Link href="/shop" className="mt-3 block text-center text-sm text-gray-500 hover:text-gray-900 transition">
              {t('cart.continue')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
