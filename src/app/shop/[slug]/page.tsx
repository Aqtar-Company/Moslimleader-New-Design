export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { Product } from '@/types';
import { applyOverride, getMergedStaticProduct, loadStaticOverrides } from '@/lib/product-overrides';
import { canonical, productJsonLd, breadcrumbJsonLd, SITE_URL, SITE_NAME } from '@/lib/seo';
import RelatedProducts from '@/components/product/RelatedProducts';

type Props = { params: Promise<{ slug: string }> };

// ── Helper: resolve product (DB first, then static + overrides) ──
async function resolveProduct(slug: string): Promise<Product | null> {
  try {
    const dbProduct = await prisma.product.findUnique({ where: { slug } });
    if (dbProduct) {
      // Static-sourced products in DB may have stale prices — apply overrides
      // via the shared helper so the detail page mirrors home + list pages.
      if (dbProduct.source === 'static') {
        const overrides = await loadStaticOverrides();
        const merged = applyOverride(dbProduct as unknown as Product, overrides[dbProduct.id]);
        return merged;
      }
      return dbProduct as unknown as Product;
    }
  } catch {}

  return getMergedStaticProduct(slug);
}

// ── Open Graph / Twitter metadata for social sharing ──
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';

  try {
    const product = await resolveProduct(slug);
    if (!product) throw new Error('not found');

    const title = product.name || 'منتج';
    const rawDesc = product.shortDescription || product.description?.replace(/<[^>]+>/g, '').slice(0, 160) || '';
    const description = rawDesc ? rawDesc : 'منتج إسلامي تربوي من متجر مسلم ليدر';
    const rawImage = product.images?.[0] || '';
    const imageUrl = rawImage.startsWith('http') ? rawImage : rawImage ? `${baseUrl}${rawImage}` : `${baseUrl}/logo.png`;
    const url = `${baseUrl}/shop/${slug}`;

    return {
      // Title formula: <product-name> | <category> | مسلم ليدر
      // Keeps the brand at the end so the relevant keyword shows up
      // first in Google's truncated SERP.
      title: `${title} | ${product.category} | مسلم ليدر`,
      description: description.slice(0, 160),
      metadataBase: new URL(baseUrl),
      alternates: { canonical: url },
      keywords: [
        product.name,
        product.category,
        'منتجات إسلامية للأطفال',
        'مسلم ليدر',
        'تربية إسلامية',
      ],
      openGraph: {
        title: `${title} | مسلم ليدر`,
        description: description.slice(0, 200),
        url,
        siteName: 'مسلم ليدر',
        images: [
          {
            url: imageUrl,
            secureUrl: imageUrl,
            width: 1200,
            height: 1200,
            alt: title,
            type: 'image/jpeg',
          },
        ],
        type: 'website',
        locale: 'ar_EG',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | مسلم ليدر`,
        description: description.slice(0, 200),
        images: [imageUrl],
        site: '@moslimleader',
      },
    };
  } catch {
    return {
      title: 'منتج | مسلم ليدر',
      description: 'تسوّق من متجر مسلم ليدر',
    };
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await resolveProduct(slug);
  if (!product) notFound();

  // JSON-LD product schema. Lets Google show the rich snippet
  // (price, availability, image) under the listing on SERP.
  const jsonLd = productJsonLd({ product });
  const breadcrumb = breadcrumbJsonLd([
    { name: 'الرئيسية', url: `${SITE_URL}/` },
    { name: 'المتجر', url: `${SITE_URL}/shop` },
    { name: product.category, url: `${SITE_URL}/shop?category=${encodeURIComponent(product.category)}` },
    { name: product.name, url: canonical(`/shop/${product.slug}`) },
  ]);
  void SITE_NAME; // keep import noticed by linter

  return (
    <>
      <script
        type="application/ld+json"
        // schema is generated server-side from trusted DB/Setting fields,
        // not user input — safe to inline. Stringify with minimal escaping.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <ProductDetailClient product={product} />
      {/* Related products live in the server component so the
          internal links are present in the initial HTML — required
          for crawlers, helpful for perceived speed. */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pb-12">
        <RelatedProducts category={product.category} excludeSlug={product.slug} />
      </div>
    </>
  );
}
