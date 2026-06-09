'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';

export default function WishlistPage() {
  const { items, remove, clear } = useWishlist();
  const { addItem } = useCart();
  const { t, isRtl } = useLang();
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setShareLoading(true);
    try {
      const res = await fetch('/api/wishlist/share', { method: 'POST' });
      if (res.status === 401) { alert(isRtl ? 'يجب تسجيل الدخول أولاً' : 'Please sign in first'); return; }
      const data = await res.json();
      if (data.token) setShareLink(`${window.location.origin}/wishlist/share/${data.token}`);
    } finally {
      setShareLoading(false);
    }
  }

  function handleCopy() {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (items.length === 0) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-[60vh] flex flex-col items-center justify-center px-4 pt-28 pb-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-2">{t('wishlist.empty.title')}</h1>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">{t('wishlist.empty.desc')}</p>
        <Link href="/"
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm">
          {t('wishlist.empty.cta')}
        </Link>
      </div>
    );
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-6xl mx-auto px-4 pt-28 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{t('wishlist.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length} {isRtl ? 'منتج' : items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!shareLink ? (
            <button onClick={handleShare} disabled={shareLoading}
              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-xl transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {shareLoading ? '...' : (isRtl ? 'مشاركة القائمة' : 'Share List')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input readOnly value={shareLink}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 w-48 truncate" />
              <button onClick={handleCopy}
                className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-xl transition">
                {copied ? '✓' : (isRtl ? 'نسخ' : 'Copy')}
              </button>
            </div>
          )}
          <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 transition">
            {t('cart.clearAll')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(product => {
          const name = isRtl ? product.name : (product.nameEn || product.name);
          return (
            <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
              {/* Image */}
              <Link href={`/shop/${product.slug}`} className="relative aspect-square bg-gray-50 block">
                <Image src={product.images[0]} alt={name} fill className="object-cover hover:scale-105 transition-transform duration-300" unoptimized />
                {!product.inStock && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1 rounded-full">{t('product.outOfStock')}</span>
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="p-3 flex flex-col gap-2 flex-1">
                <Link href={`/shop/${product.slug}`}>
                  <h3 className="font-bold text-gray-900 text-sm leading-snug hover:text-purple-700 transition line-clamp-2">{name}</h3>
                </Link>
                <span className="font-black text-gray-900 text-base">
                  {product.price} <span className="text-xs font-normal text-gray-500">{t('cart.currency')}</span>
                </span>

                <div className="mt-auto flex flex-col gap-2 pt-1">
                  <button
                    disabled={!product.inStock}
                    onClick={() => product.inStock && addItem(product)}
                    className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-xs font-bold py-2 rounded-xl transition"
                  >
                    {product.inStock ? t('product.addToCart') : t('product.unavailable')}
                  </button>
                  <button
                    onClick={() => remove(product.id)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-semibold transition py-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('wishlist.remove')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
