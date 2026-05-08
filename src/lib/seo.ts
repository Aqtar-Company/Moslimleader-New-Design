// SEO helpers — canonical URL builder + JSON-LD generators.
// Centralised so every page emits the same shape and Google sees a
// consistent organisation/website graph across the site.

import type { Product } from '@/types';

export const SITE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
export const SITE_NAME = 'مسلم ليدر';
export const SITE_NAME_EN = 'Moslim Leader';
export const ORG_LOGO = `${SITE_URL}/logo.png`;
export const ORG_DESCRIPTION =
  'منصة مسلم ليدر — متجر متخصص في كتب وألعاب الأطفال الإسلامية، حقائب مدرسية، ومنتجات تعليمية للأمهات اللي بيربّو قادة الغد على القيم.';

// Build a canonical URL for a page path. Always uses SITE_URL so
// subdomain leaks (preview deploys, www vs apex) don't dilute rank.
export function canonical(path: string): string {
  const cleaned = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleaned}`;
}

// Resolve a stored image to an absolute URL (Next.js OG + JSON-LD
// both require absolute paths).
export function absUrl(maybePath: string | null | undefined, fallback = `${SITE_URL}/logo.png`): string {
  if (!maybePath) return fallback;
  if (maybePath.startsWith('http://') || maybePath.startsWith('https://')) {
    return maybePath;
  }
  return `${SITE_URL}${maybePath.startsWith('/') ? '' : '/'}${maybePath}`;
}

// ─────────── JSON-LD generators ───────────

export interface ProductJsonLdInput {
  product: Pick<Product, 'name' | 'nameEn' | 'slug' | 'price' | 'priceUsd' | 'images' | 'category' | 'inStock' | 'shortDescription' | 'description'>;
  /** Effective stock for availability decision (0 = out of stock). */
  effectiveStock?: number;
  /** Optional review aggregate; pass when available. */
  rating?: { value: number; count: number };
}

export function productJsonLd({ product, effectiveStock, rating }: ProductJsonLdInput) {
  const description =
    (product.shortDescription || stripHtml(product.description) || ORG_DESCRIPTION).slice(0, 5000);
  const inStock = effectiveStock !== undefined ? effectiveStock > 0 : product.inStock;

  const images = Array.isArray(product.images) && product.images.length > 0
    ? (product.images as string[]).slice(0, 5).map(img => absUrl(img))
    : [ORG_LOGO];

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: images,
    description,
    sku: product.slug,
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: product.category,
    offers: {
      '@type': 'Offer',
      url: canonical(`/shop/${product.slug}`),
      priceCurrency: 'EGP',
      price: String(Math.round(product.price)),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating.value.toFixed(1),
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export interface BookJsonLdInput {
  book: {
    id: string;
    title: string;
    titleEn?: string | null;
    description?: string | null;
    cover?: string | null;
    language?: string | null;
    price?: number | null;
    isPublished?: boolean;
    author?: string | null;
  };
}

export function bookJsonLd({ book }: BookJsonLdInput) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Book',
    name: book.title,
    alternateName: book.titleEn ?? undefined,
    description: book.description ?? `كتاب رقمي على منصة ${SITE_NAME}`,
    image: absUrl(book.cover ?? undefined),
    inLanguage: book.language ?? 'ar',
    bookFormat: 'https://schema.org/EBook',
    url: canonical(`/library/${book.id}`),
    author: book.author
      ? { '@type': 'Person', name: book.author }
      : { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    ...(book.price !== null && book.price !== undefined && book.price > 0
      ? {
          offers: {
            '@type': 'Offer',
            url: canonical(`/library/${book.id}/buy`),
            priceCurrency: 'EGP',
            price: String(Math.round(book.price)),
            availability: book.isPublished
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          },
        }
      : {}),
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: SITE_URL,
    logo: ORG_LOGO,
    description: ORG_DESCRIPTION,
    sameAs: [
      'https://www.facebook.com/moslimleader',
      'https://www.instagram.com/moslimleader',
    ],
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org/',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: SITE_URL,
    inLanguage: 'ar',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/shop?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Strip HTML for clean meta descriptions.
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
