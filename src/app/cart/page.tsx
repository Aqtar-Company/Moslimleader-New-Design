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

  /* ── Empty state ── */
  if (items.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 pt-20"
        style={{ background: 'linear-gradient(160deg,#F5C518 0%,#e8b800 100%)' }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="w-28 h-28 rounded-full bg-black flex items-center justify-center text-6xl shadow-xl">🛒</div>
        <h1 className="text-2xl font-black text-black">{t('cart.empty.title')}</h1>
        <p className="text-black/60 font-medium">{t('cart.empty.desc')}</p>
        <Link
          href="/"
          className="bg-black text-white px-8 py-3 rounded-xl font-black hover:bg-gray-800 transition"
        >
          {t('cart.empty.cta')}
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pt-24 pb-16"
      style={{ background: 'linear-gradient(160deg,#F5C518 0%,#e8b800 100%)' }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* subtle overlay */}
      <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />

      <div className="max-w-5xl mx-auto px-4 relative z-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-black">{t('cart.title')}</h1>
          <button
            onClick={clear}
            className="text-sm text-black/50 hover:text-black font-bold border border-black/20 px-4 py-1.5 rounded-lg hover:border-black/50 transition"
          >
            {t('cart.clearAll')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Items list */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="bg-white rounded-2xl shadow-md p-4 flex gap-4 items-center">
                {/* Image */}
                <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
                  <Image src={product.images[0]} alt={product.name} fill className="object-cover" unoptimized />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{product.name}</p>
                  <p className="text-black font-black mt-1 text-sm">
                    {product.price} {currency}
                  </p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => updateQty(product.id, quantity - 1)}
                    className="w-8 h-8 rounded-full bg-[#F5C518] text-black flex items-center justify-center font-black text-lg leading-none hover:bg-yellow-400 transition"
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-black text-gray-900">{quantity}</span>
                  <button
                    onClick={() => updateQty(product.id, quantity + 1)}
                    className="w-8 h-8 rounded-full bg-[#F5C518] text-black flex items-center justify-center font-black text-lg leading-none hover:bg-yellow-400 transition"
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div className={`shrink-0 min-w-[70px] ${isRtl ? 'text-left' : 'text-right'}`}>
                  <p className="font-black text-gray-900 text-sm">{product.price * quantity} {currency}</p>
                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition mt-1 font-semibold"
                  >
                    {t('cart.delete')}
                  </button>
                </div>
              </div>
            ))}

            <Link href="/" className="text-sm text-black/60 hover:text-black font-semibold transition mt-1 inline-flex items-center gap-1">
              {isRtl ? '→' : '←'} {t('cart.continue')}
            </Link>
          </div>

          {/* Summary — black card */}
          <div className="lg:col-span-1">
            <div className="bg-black rounded-2xl shadow-xl p-6 sticky top-28">
              <h2 className="text-base font-black text-white mb-5">{t('cart.summary.title')}</h2>

              <div className="flex flex-col gap-3 text-sm text-gray-400">
                <div className="flex justify-between">
                  <span>{t('cart.summary.subtotal')}</span>
                  <span className="font-bold text-white">{total} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('cart.summary.shipping')}</span>
                  <span className="font-bold text-white">{shipping} {currency}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between text-base font-black">
                  <span className="text-white">{t('cart.summary.total')}</span>
                  <span className="text-[#F5C518]">{total + shipping} {currency}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href="/checkout"
                  className="w-full bg-[#F5C518] text-black py-3.5 rounded-xl font-black hover:bg-yellow-300 transition text-sm text-center shadow-lg"
                >
                  {t('cart.checkout')}
                </Link>
                {!user && (
                  <p className="text-xs text-center text-gray-500 mt-1">
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
