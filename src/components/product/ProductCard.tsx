'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product, ProductVariant } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLang } from '@/context/LanguageContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { useToast } from '@/components/ui/Toast';

const MODEL_CATEGORIES = ['مجات', 'مفكرات'];
const MODEL_SLUGS_WITH_COVER = ['masek', 'ml-pin'];
const MODEL_SLUGS_NO_COVER = ['ml-bag'];

export default function ProductCard({ product, priceLoading = false }: { product: Product; priceLoading?: boolean }) {
  const { addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const { t, isRtl } = useLang();
  const { getProductPrice, formatPrice } = useRegionalPricing();
  const { addToast } = useToast();
  const [added, setAdded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedModel, setSelectedModel] = useState<number | null>(null);

  const displayName = isRtl ? product.name : (product.nameEn || product.name);
  const displayShortDesc = isRtl ? product.shortDescription : (product.shortDescriptionEn || product.shortDescription);
  const wishlisted = isWishlisted(product.id);
  const priceResult = getProductPrice(product);

  const hasVariants = !!(product.variants && product.variants.length > 0);
  const needsLegacyModel = !hasVariants && (
    MODEL_CATEGORIES.includes(product.category)
    || MODEL_SLUGS_WITH_COVER.includes(product.slug)
    || MODEL_SLUGS_NO_COVER.includes(product.slug)
  );
  const needsModel = hasVariants || needsLegacyModel;
  const modelOffset = MODEL_SLUGS_NO_COVER.includes(product.slug) ? 0 : 1;
  const modelImages = needsLegacyModel ? product.images.slice(modelOffset) : [];

  function handleAddClick() {
    if (!product.inStock || priceLoading) return;
    if (needsModel) {
      setSelectedVariant(null);
      setSelectedModel(null);
      setShowModal(true);
    } else {
      doAddToCart(undefined);
    }
  }

  function doAddToCart(modelIdx: number | undefined) {
    addItem(product, modelIdx, 1);
    addToast(`✓ أُضيف "${displayName}" للسلة`, 'success');
    setAdded(true);
    setShowModal(false);
    setTimeout(() => setAdded(false), 1500);
  }

  function confirmModal() {
    if (hasVariants) {
      if (!selectedVariant) return;
      doAddToCart(selectedVariant.imageIndex >= 0 ? selectedVariant.imageIndex : undefined);
    } else {
      if (selectedModel === null) return;
      doAddToCart(selectedModel);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden flex flex-col">
        {/* Image */}
        <Link href={`/shop/${product.slug}`} target="_blank" rel="noopener noreferrer" className="block relative aspect-square overflow-hidden bg-gray-50">
          <Image
            src={product.images[0]}
            alt={displayName}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            quality={75}
            className="object-cover hover:scale-105 transition-transform duration-300"
          />
          {!product.inStock && !priceLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1 rounded-full">{t('product.outOfStock')}</span>
            </div>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(product); }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition z-10"
            aria-label={wishlisted ? t('wishlist.remove') : t('wishlist.add')}
          >
            <svg className="w-4 h-4 transition" fill={wishlisted ? '#ef4444' : 'none'} stroke={wishlisted ? '#ef4444' : '#9ca3af'} strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </button>
        </Link>

        {/* Info */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <Link href={`/shop/${product.slug}`} target="_blank" rel="noopener noreferrer">
            <h3 className="font-bold text-gray-900 text-base leading-snug hover:text-purple-700 transition line-clamp-2">
              {displayName}
            </h3>
          </Link>
          <p className="text-gray-500 text-sm line-clamp-2">{displayShortDesc}</p>

          <div className="mt-auto pt-3 flex items-center justify-between gap-1.5">
            {priceLoading ? (
              <span className="h-6 w-20 bg-gray-200 rounded-lg animate-pulse shrink-0" />
            ) : (
              <span className="text-gray-900 font-bold text-sm sm:text-lg shrink-0">{formatPrice(priceResult)}</span>
            )}
            <button
              disabled={(!product.inStock && !priceLoading) || added || priceLoading}
              onClick={handleAddClick}
              className={`text-white text-xs sm:text-sm font-semibold px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
                added
                  ? 'bg-green-500 scale-95'
                  : priceLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : product.inStock
                      ? 'bg-purple-700 hover:bg-purple-800 active:scale-95'
                      : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {added
                ? t('product.added')
                : priceLoading
                  ? <span className="h-4 w-16 bg-gray-400 rounded inline-block animate-pulse" />
                  : product.inStock
                    ? t('product.addToCart')
                    : t('product.unavailable')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Variant picker modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          {/* Sheet */}
          <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl z-10 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="font-bold text-gray-900 text-sm line-clamp-1">{displayName}</p>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                {isRtl ? 'اختر الموديل' : 'Select a Model'}
              </p>

              {/* Named variants (admin-defined) */}
              {hasVariants && product.variants && (
                <div className="grid grid-cols-2 gap-2">
                  {product.variants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition text-right ${
                        selectedVariant?.id === v.id
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {v.imageIndex >= 0 && product.images[v.imageIndex] && (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                          <Image src={product.images[v.imageIndex]} alt={v.name} fill className="object-cover" unoptimized />
                        </div>
                      )}
                      <span className="text-xs font-bold text-gray-800 leading-tight">
                        {isRtl ? v.name : (v.nameEn || v.name)}
                      </span>
                      {selectedVariant?.id === v.id && (
                        <span className="mr-auto shrink-0 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Legacy image-based models */}
              {needsLegacyModel && modelImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {modelImages.map((img, i) => {
                    const imgIdx = i + modelOffset;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedModel(imgIdx)}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${
                          selectedModel === imgIdx
                            ? 'border-purple-600 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <Image src={img} alt={`موديل ${i + 1}`} fill className="object-cover" unoptimized />
                        {selectedModel === imgIdx && (
                          <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center">
                            <span className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shadow">
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Confirm button */}
              <button
                onClick={confirmModal}
                disabled={hasVariants ? !selectedVariant : selectedModel === null}
                className="w-full bg-purple-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition hover:bg-purple-800 active:scale-95 disabled:cursor-not-allowed text-sm"
              >
                {hasVariants
                  ? selectedVariant
                    ? `${isRtl ? 'أضف' : 'Add'} — ${isRtl ? selectedVariant.name : (selectedVariant.nameEn || selectedVariant.name)}`
                    : (isRtl ? 'اختر موديلاً أولاً' : 'Select a model first')
                  : selectedModel !== null
                    ? (isRtl ? 'أضف للسلة' : 'Add to Cart')
                    : (isRtl ? 'اختر موديلاً أولاً' : 'Select a model first')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
