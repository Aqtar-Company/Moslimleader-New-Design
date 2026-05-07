export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { Product } from '@/types';
import { applyOverride, getMergedStaticProduct, loadStaticOverrides } from '@/lib/product-overrides';

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
      title: `${title} | مسلم ليدر`,
      description,
      metadataBase: new URL(baseUrl),
      openGraph: {
        title: `${title} | مسلم ليدر`,
        description,
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
        description,
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
  return <ProductDetailClient product={product} />;
}
