'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';
import { useLang } from '@/context/LanguageContext';
import Link from 'next/link';

export default function SharedWishlistPage() {
  const { token } = useParams<{ token: string }>();
  const { isRtl } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'expired' | 'error'>('loading');

  useEffect(() => {
    fetch(`/api/wishlist/share?token=${token}`)
      .then(async r => {
        if (r.status === 410) { setStatus('expired'); return; }
        if (!r.ok) { setStatus('error'); return; }
        const data = await r.json();
        setProducts((data.products ?? []).filter(Boolean));
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 pt-24">
        <div className="text-5xl">⏰</div>
        <h1 className="text-xl font-black text-gray-900">{isRtl ? 'انتهت صلاحية هذا الرابط' : 'This link has expired'}</h1>
        <p className="text-gray-500 text-sm">{isRtl ? 'روابط المشاركة صالحة لمدة 7 أيام فقط' : 'Share links are valid for 7 days only'}</p>
        <Link href="/" className="mt-2 bg-gray-900 text-white font-bold px-6 py-2.5 rounded-xl text-sm">{isRtl ? 'تسوق الآن' : 'Shop now'}</Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 pt-24">
        <div className="text-5xl">❌</div>
        <h1 className="text-xl font-black text-gray-900">{isRtl ? 'الرابط غير صالح' : 'Invalid link'}</h1>
        <Link href="/" className="mt-2 bg-gray-900 text-white font-bold px-6 py-2.5 rounded-xl text-sm">{isRtl ? 'الرئيسية' : 'Home'}</Link>
      </div>
    );
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-6xl mx-auto px-4 py-10 pt-28">
      <div className="text-center mb-10">
        <div className="text-4xl mb-3">🎁</div>
        <h1 className="text-2xl font-black text-gray-900 mb-1">
          {isRtl ? 'قائمة أمنيات مشتركة' : 'Shared Wishlist'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isRtl ? `${products.length} منتج في هذه القائمة` : `${products.length} items in this list`}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-semibold">{isRtl ? 'القائمة فارغة' : 'Empty list'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
