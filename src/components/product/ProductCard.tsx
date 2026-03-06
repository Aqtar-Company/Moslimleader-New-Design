'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { t, isRtl } = useLang();

  const displayName = isRtl ? product.name : (product.nameEn || product.name);
  const displayShortDesc = isRtl ? product.shortDescription : (product.shortDescriptionEn || product.shortDescription);

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden flex flex-col">
      {/* Image */}
      <Link href={`/shop/${product.slug}`} className="block relative aspect-square overflow-hidden bg-gray-50">
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
      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <Link href={`/shop/${product.slug}`}>
          <h3 className="font-bold text-gray-900 text-base leading-snug hover:text-purple-700 transition line-clamp-2">
            {displayName}
          </h3>
        </Link>
        <p className="text-gray-500 text-sm line-clamp-2">{displayShortDesc}</p>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className="text-gray-900 font-bold text-lg">{product.price} {t('cart.currency')}</span>
          <button
            disabled={!product.inStock}
            onClick={() => product.inStock && addItem(product)}
            className="bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
          >
            {product.inStock ? t('product.addToCart') : t('product.unavailable')}
          </button>
        </div>
      </div>
    </div>
  );
}
