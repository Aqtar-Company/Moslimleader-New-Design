'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { products } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';

// activeMedia: { type: 'image', index: number } | { type: 'video', index: number }
type ActiveMedia = { type: 'image'; index: number } | { type: 'video'; index: number };

function PlayIcon() {
  return (
    <svg className="w-6 h-6 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const [active, setActive] = useState<ActiveMedia>({ type: 'image', index: 0 });
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

  const hasThumbs = product.images.length > 1 || videos.length > 0;

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

          {/* ── Media Column ── */}
          <div className="flex flex-col gap-4">

            {/* Main viewer */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
              {active.type === 'image' ? (
                <>
                  <Image
                    src={product.images[active.index]}
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
                </>
              ) : (
                <iframe
                  src={`https://www.youtube.com/embed/${videos[active.index]}?autoplay=1`}
                  title={`${displayName} - ${isRtl ? 'فيديو' : 'Video'} ${active.index + 1}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              )}
            </div>

            {/* Thumbnails strip */}
            {hasThumbs && (
              <div className="flex gap-2 overflow-x-auto pb-1">

                {/* Image thumbs */}
                {product.images.map((img, i) => {
                  const isActive = active.type === 'image' && active.index === i;
                  return (
                    <button
                      key={`img-${i}`}
                      onClick={() => setActive({ type: 'image', index: i })}
                      className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                        isActive ? 'border-[#F5C518]' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <Image src={img} alt="" fill className="object-cover" unoptimized />
                    </button>
                  );
                })}

                {/* Video thumbs */}
                {videos.map((videoId, i) => {
                  const isActive = active.type === 'video' && active.index === i;
                  return (
                    <button
                      key={`vid-${i}`}
                      onClick={() => setActive({ type: 'video', index: i })}
                      className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition group ${
                        isActive ? 'border-red-500' : 'border-gray-200 hover:border-red-400'
                      }`}
                    >
                      {/* YouTube thumbnail */}
                      <Image
                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                        alt={`video ${i + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition" />
                      {/* Play icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center shadow-md">
                          <PlayIcon />
                        </div>
                      </div>
                    </button>
                  );
                })}
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
