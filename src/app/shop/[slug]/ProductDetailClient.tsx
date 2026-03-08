'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { products } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';

export default function ProductDetailClient({ product }: { product: Product }) {
  const [mainImg, setMainImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const { t, isRtl } = useLang();

  const videos = product.videos ?? [];

  const displayName = isRtl ? product.name : (product.nameEn || product.name);
  const displayShortDesc = isRtl ? product.shortDescription : (product.shortDescriptionEn || product.shortDescription);
  const displayDescription = isRtl ? product.description : (product.descriptionEn || product.description);

  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  function handleAdd() {
    for (let i = 0; i < qty; i++) addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Breadcrumb */}
      <div className="bg-gray-50 py-3 border-b">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-900 transition">{t('nav.home')}</Link>
          <span>/</span>
          <Link href="/" className="hover:text-gray-900 transition">{t('nav.shop')}</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{displayName}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

          {/* Images */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
              <Image
                src={product.images[mainImg]}
                alt={displayName}
                fill
                className="object-contain p-4"
                unoptimized
              />
              {!product.inStock && (
                <div className="absolute top-3 right-3 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {t('product.outOfStock')}
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setMainImg(i)}
                    className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                      mainImg === i ? 'border-[#F5C518]' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <Image src={img} alt="" fill className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-5">
            <div>
              <span className="bg-[#FFF9E6] text-[#9a7b00] text-xs font-bold px-3 py-1 rounded-full">
                {product.category}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">
              {displayName}
            </h1>
            <p className="text-gray-500">{displayShortDesc}</p>

            <div className="text-3xl font-black text-gray-900">
              {product.price} <span className="text-lg font-bold text-gray-500">{t('cart.currency')}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${product.inStock ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className={`text-sm font-semibold ${product.inStock ? 'text-green-600' : 'text-red-500'}`}>
                {product.inStock ? t('product.inStock') : t('product.outOfStock')}
              </span>
            </div>

            {product.inStock && (
              <div className="flex items-center gap-3">
                <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-gray-100 transition">−</button>
                  <span className="w-10 text-center font-bold">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-gray-100 transition">+</button>
                </div>
                <button
                  onClick={handleAdd}
                  className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 px-6 rounded-xl transition text-center"
                >
                  {added ? t('product.added') : t('product.addToCart')}
                </button>
              </div>
            )}

            <div className="product-description border-t pt-5 mt-2" dangerouslySetInnerHTML={{ __html: displayDescription }} />

            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {product.tags.map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Videos Section ── */}
        {videos.length > 0 && (
          <div className="mt-12 border-t border-gray-100 pt-10">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              {isRtl ? 'فيديوهات المنتج' : 'Product Videos'}
            </h2>
            <div className={`grid gap-5 ${videos.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 md:grid-cols-2'}`}>
              {videos.map((videoId, i) => (
                <div key={videoId} className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-black aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={`${displayName} - ${isRtl ? 'فيديو' : 'Video'} ${i + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-black text-gray-900 mb-6">{t('product.related')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
