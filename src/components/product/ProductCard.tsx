'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useLang } from '@/context/LanguageContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const { t, isRtl } = useLang();
  const { getProductPrice, formatPrice } = useRegionalPricing();
  const [added, setAdded] = useState(false);

  const displayName = isRtl ? product.name : (product.nameEn || product.name);
  const displayShortDesc = isRtl ? product.shortDescription : (product.shortDescriptionEn || product.shortDescription);
  const wishlisted = isWishlisted(product.id);
  const priceResult = getProductPrice(product);

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden flex flex-col">
      {/* Image */}
      <Link href={`/shop/${product.slug}`} target="_blank" rel="noopener noreferrer" className="block relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={product.images[0]}
          alt={displayName}
          fill
          className="object-cover hover:scale-105 transition-transform duration-300"
          unoptimized
        />
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1 rounded-full">{t('product.outOfStock')}</span>
          </div>
        )}
        {/* Wishlist heart */}
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
          <span className="text-gray-900 font-bold text-sm sm:text-lg shrink-0">{formatPrice(priceResult)}</span>
          <button
            disabled={!product.inStock || added}
            onClick={() => {
              if (!product.inStock) return;
              addItem(product);
              setAdded(true);
              setTimeout(() => setAdded(false), 1500);
            }}
            className={`text-white text-xs sm:text-sm font-semibold px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
              added
                ? 'bg-green-500 scale-95'
                : product.inStock
                  ? 'bg-purple-700 hover:bg-purple-800 active:scale-95'
                  : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {added ? t('product.added') : product.inStock ? t('product.addToCart') : t('product.unavailable')}
          </button>
        </div>
      </div>
    </div>
  );
}
