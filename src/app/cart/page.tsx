'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';

export default function CartPage() {
  const { items, total, discount, coupon, applyCoupon, removeCoupon, updateQty, removeItem, clear } = useCart();
  const { t, isRtl } = useLang();
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState(false);

  if (items.length === 0) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-[60vh] flex flex-col items-center justify-center px-4 pt-28 pb-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-2">{t('cart.empty.title')}</h1>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">{t('cart.empty.desc')}</p>
        <Link href="/"
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm">
          {t('cart.empty.cta')}
        </Link>
      </div>
    );
  }

  const shipping = 80;
  const grandTotal = total - discount + shipping;

  function handleApplyCoupon() {
    const ok = applyCoupon(couponInput);
    if (ok) { setCouponError(false); setCouponInput(''); }
    else { setCouponError(true); }
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-6xl mx-auto px-4 pt-28 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{t('cart.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length} {isRtl ? 'منتج' : items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 transition">
          {t('cart.clearAll')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Items */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {items.map(item => (
            <div key={item.cartItemId}
              className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition">

              <Link href={`/shop/${item.product.slug}`}
                className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                <Image
                  src={item.selectedModel !== undefined ? item.product.images[item.selectedModel] : item.product.images[0]}
                  alt={item.product.name}
                  fill className="object-cover" unoptimized />
              </Link>

              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <Link href={`/shop/${item.product.slug}`}
                  className="font-bold text-gray-900 hover:text-purple-700 transition text-sm leading-snug line-clamp-2">
                  {isRtl ? item.product.name : (item.product.nameEn || item.product.name)}
                </Link>
                <span className="text-xs text-gray-400">{item.product.category}</span>
                <span className="font-black text-gray-900 text-sm">
                  {item.product.price} <span className="font-normal text-gray-500 text-xs">{t('cart.currency')}</span>
                </span>
              </div>

              <div className="shrink-0 flex flex-col items-end justify-between gap-2">
                <button onClick={() => removeItem(item.cartItemId)}
                  className="text-gray-300 hover:text-red-400 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button onClick={() => updateQty(item.cartItemId, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center text-sm hover:bg-gray-100 transition font-bold text-gray-700">−</button>
                  <span className="w-7 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                  <button onClick={() => updateQty(item.cartItemId, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center text-sm hover:bg-gray-100 transition font-bold text-gray-700">+</button>
                </div>
                <span className="text-sm font-black text-gray-900">
                  {item.product.price * item.quantity} <span className="font-normal text-gray-400 text-xs">{t('cart.currency')}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-950 rounded-2xl p-6 sticky top-24 text-white">
            <h2 className="font-black text-base mb-5">{t('cart.summary.title')}</h2>

            {/* Coupon */}
            <div className="mb-5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">{t('cart.coupon.label')}</label>
              {coupon ? (
                <div className="flex items-center justify-between bg-green-900/40 border border-green-700/40 rounded-xl px-4 py-2.5">
                  <div>
                    <span className="text-green-400 text-xs font-black">{t('cart.coupon.applied')}</span>
                    <span className="text-green-300 text-xs mr-2 ml-2">— {coupon.code} ({coupon.pct}%)</span>
                  </div>
                  <button onClick={removeCoupon} className="text-gray-500 hover:text-red-400 transition text-lg leading-none">×</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={e => { setCouponInput(e.target.value); setCouponError(false); }}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                    placeholder={t('cart.coupon.ph')}
                    className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#F5C518]/50 uppercase tracking-wider"
                  />
                  <button onClick={handleApplyCoupon}
                    className="bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition shrink-0">
                    {t('cart.coupon.apply')}
                  </button>
                </div>
              )}
              {couponError && (
                <p className="text-red-400 text-xs mt-1.5 font-semibold">{t('cart.coupon.invalid')}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>{t('cart.summary.subtotal')}</span>
                <span className="text-white font-semibold">{total} {t('cart.currency')}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-green-400">
                  <span>{t('cart.coupon.discount')} ({coupon.pct}%)</span>
                  <span className="font-semibold">−{discount} {t('cart.currency')}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-400">
                <span>{t('cart.summary.shipping')}</span>
                <span className="text-white font-semibold">{shipping} {t('cart.currency')}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between">
                <span className="font-black text-base">{t('cart.summary.total')}</span>
                <span className="font-black text-xl text-[#F5C518]">{grandTotal} <span className="text-sm font-bold text-gray-300">{t('cart.currency')}</span></span>
              </div>
            </div>

            <Link href="/checkout"
              className="mt-6 flex items-center justify-center gap-2 w-full bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-black py-4 rounded-xl transition text-sm">
              {t('cart.checkout')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
              </svg>
            </Link>

            <Link href="/"
              className="mt-3 block text-center text-xs text-gray-500 hover:text-gray-300 transition">
              {t('cart.continue')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
