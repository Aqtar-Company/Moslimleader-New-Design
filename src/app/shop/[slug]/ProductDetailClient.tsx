'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { products } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';
import { Product } from '@/types';
import ProductCard from '@/components/product/ProductCard';

const MODEL_CATEGORIES = ['مجات', 'مفكرات'];
// Slugs where images[0] is overview and images[1+] are models
const MODEL_SLUGS_WITH_COVER = ['masek', 'ml-pin'];
// Slugs where ALL images are selectable models (no overview image)
const MODEL_SLUGS_NO_COVER = ['ml-bag'];

export default function ProductDetailClient({ product }: { product: Product }) {
  const [mainImg, setMainImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<number | undefined>(undefined);
  const { addItem } = useCart();
  const { t, isRtl } = useLang();

  const needsModel = MODEL_CATEGORIES.includes(product.category)
    || MODEL_SLUGS_WITH_COVER.includes(product.slug)
    || MODEL_SLUGS_NO_COVER.includes(product.slug);
  // bags: all images are models (offset=0); everything else: images[0] is overview (offset=1)
  const modelOffset = MODEL_SLUGS_NO_COVER.includes(product.slug) ? 0 : 1;
  const modelImages = needsModel ? product.images.slice(modelOffset) : [];

  const videos = product.videos ?? [];

  const displayName = isRtl ? product.name : (product.nameEn || product.name);
  const displayShortDesc = isRtl ? product.shortDescription : (product.shortDescriptionEn || product.shortDescription);
  const displayDescription = isRtl ? product.description : (product.descriptionEn || product.description);

  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  function handleAdd() {
    if (needsModel && selectedModel === undefined) return;
    for (let i = 0; i < qty; i++) addItem(product, selectedModel);
    setAdded(true);
    setSelectedModel(undefined);
    setQty(1);
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
                {t(`cat.${product.category}` as Parameters<typeof t>[0])}
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

            {/* Model selector (mugs, notebooks, bags) */}
            {needsModel && modelImages.length > 0 && (
              <div>
                <p className="text-sm font-bold text-gray-700 mb-2">
                  {isRtl ? 'اختر الموديل' : 'Select Model'}
                  {selectedModel !== undefined && (
                    <span className="text-purple-700 mr-2 ml-2">
                      — {isRtl ? `موديل ${selectedModel - modelOffset + 1}` : `Model ${selectedModel - modelOffset + 1}`}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {modelImages.map((img, i) => {
                    const imgIdx = i + modelOffset;
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedModel(imgIdx); setMainImg(imgIdx); }}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                          selectedModel === imgIdx
                            ? 'border-purple-600 ring-2 ring-purple-300'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <Image src={img} alt={`Model ${i + 1}`} fill className="object-cover" unoptimized />
                      </button>
                    );
                  })}
                </div>
                {selectedModel === undefined && (
                  <p className="text-amber-600 text-xs mt-1.5 font-semibold">
                    {isRtl ? '* يرجى اختيار الموديل أولاً' : '* Please select a model first'}
                  </p>
                )}
              </div>
            )}

            {product.inStock && (
              <div className="flex items-center gap-3">
                <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-gray-100 transition">−</button>
                  <span className="w-10 text-center font-bold">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center text-xl font-bold hover:bg-gray-100 transition">+</button>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={needsModel && selectedModel === undefined}
                  className={`flex-1 font-bold py-3 px-6 rounded-xl transition text-center ${
                    needsModel && selectedModel === undefined
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-700 hover:bg-purple-800 text-white'
                  }`}
                >
                  {added ? t('product.added') : t('product.addToCart')}
                </button>
              </div>
            )}

            {/* Weight badge */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <span>{isRtl ? 'الوزن:' : 'Weight:'} <strong className="text-gray-700">{product.weight}g</strong></span>
            </div>

            <div className="product-description border-t pt-5 mt-2" dangerouslySetInnerHTML={{ __html: displayDescription }} />

            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {product.tags.map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                    #{t(`tag.${tag}` as Parameters<typeof t>[0])}
                  </span>
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

        {/* Reviews Section */}
        {product.reviews && product.reviews.length > 0 && (
          <div className="mt-12 border-t border-gray-100 pt-10">
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <span>⭐</span>
                {isRtl ? 'آراء العملاء' : 'Customer Reviews'}
              </h2>
              {/* Average rating */}
              {(() => {
                const avg = product.reviews!.reduce((s, r) => s + r.rating, 0) / product.reviews!.length;
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} className={`w-5 h-5 ${s <= Math.round(avg) ? 'text-[#F5C518]' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="font-bold text-gray-900">{avg.toFixed(1)}</span>
                    <span className="text-gray-400 text-sm">({product.reviews!.length} {isRtl ? 'تقييم' : 'reviews'})</span>
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.reviews.map(review => (
                <div key={review.id} className="bg-gray-50 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-[#F5C518]/20 flex items-center justify-center font-black text-[#9a7b00] text-sm">
                        {review.author.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{review.author}</p>
                        {review.verified && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            {isRtl ? 'مشترٍ موثق' : 'Verified purchase'}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(review.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {[1,2,3,4,5].map(s => (
                      <svg key={s} className={`w-4 h-4 ${s <= review.rating ? 'text-[#F5C518]' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {isRtl ? review.comment : (review.commentEn || review.comment)}
                  </p>
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
