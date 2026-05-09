'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/Toast';
import type { Product } from '@/types';

// Inline product card rendered inside an Amin reply when the AI
// recommends a specific item. Pulls live data from the public
// /api/products/[slug] endpoint so the price + image + stock are
// always current. The "أضف للسلة" button reuses the same CartContext
// the rest of the site uses, so the cart count in the header
// updates instantly.

interface Props {
  slug: string;
  /** Compact = no image, just name + price. Used when 2+ cards stack. */
  compact?: boolean;
}

interface ProductLite {
  id: string;
  slug: string;
  name: string;
  price: number;
  images?: string[];
  inStock?: boolean;
  variants?: Array<{ id: string; name: string }> | null;
  needsParentalGuide?: boolean;
  minAge?: number | null;
  maxAge?: number | null;
}

const cache = new Map<string, ProductLite | null>();

export default function AmeenProductCard({ slug, compact = false }: Props) {
  const [product, setProduct] = useState<ProductLite | null | undefined>(
    () => cache.get(slug),
  );
  const { addItem } = useCart();
  const { addToast } = useToast();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (cache.has(slug)) return;
    let alive = true;
    fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { product?: ProductLite } | null) => {
        const p = data?.product ?? null;
        cache.set(slug, p);
        if (alive) setProduct(p);
      })
      .catch(() => {
        cache.set(slug, null);
        if (alive) setProduct(null);
      });
    return () => { alive = false; };
  }, [slug]);

  if (product === undefined) {
    return (
      <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2.5 text-[11px] text-gray-400 animate-pulse">
        جاري تحميل تفاصيل المنتج...
      </div>
    );
  }
  if (product === null) {
    // Product missing — fall back to a plain link so the customer
    // can still reach the product page if they navigate manually.
    return (
      <Link
        href={`/shop/${slug}`}
        className="mt-2 inline-block text-[11px] font-bold text-[#1a1a2e] underline"
      >
        اعرض المنتج →
      </Link>
    );
  }

  const image = product.images?.[0];
  const hasVariants = !!(product.variants && product.variants.length > 0);

  async function onAdd() {
    if (adding) return;
    setAdding(true);
    try {
      addItem(product as unknown as Product, undefined, 1);
      addToast(`تمت الإضافة: ${product!.name}`, 'success');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex gap-2.5 p-2.5">
      {!compact && image && (
        <Link href={`/shop/${slug}`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={product.name}
            width={64}
            height={64}
            loading="lazy"
            className="w-16 h-16 rounded-lg object-cover"
          />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <Link href={`/shop/${slug}`} className="block">
          <p className="text-[12px] font-black text-gray-900 leading-snug line-clamp-2">{product.name}</p>
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[12px] font-black text-[#1a1a2e]">{Math.round(product.price)} ج.م</span>
          {product.minAge != null && product.maxAge != null && (
            <span className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-full border border-amber-200">
              {product.minAge}-{product.maxAge} سنوات
            </span>
          )}
          {product.needsParentalGuide && (
            <span className="text-[9px] bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded-full border border-purple-200">
              👨‍👩‍👧 مع الوالدين
            </span>
          )}
          {product.inStock === false && (
            <span className="text-[9px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200">
              غير متوفر
            </span>
          )}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {/* Variant products can't add-to-cart from the chat (we'd
              be guessing the model). Show a single full-width
              'اعرض المنتج' button that goes straight to the product
              page where the variant picker lives. */}
          {hasVariants ? (
            <Link
              href={`/shop/${slug}`}
              className="flex-1 text-center text-[10px] font-black bg-[#1a1a2e] hover:bg-[#2d1060] text-white rounded-lg px-2 py-1.5 transition"
            >
              🛍️ اعرض المنتج لاختيار الموديل
            </Link>
          ) : (
            <>
              <button
                onClick={onAdd}
                disabled={adding || product.inStock === false}
                className="flex-1 text-[10px] font-black bg-[#1a1a2e] hover:bg-[#2d1060] text-white rounded-lg px-2 py-1.5 disabled:opacity-50 transition"
              >
                🛒 أضف للسلة
              </button>
              <Link
                href={`/shop/${slug}`}
                className="text-[10px] font-bold text-[#1a1a2e] border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-gray-50"
              >
                اعرض
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
