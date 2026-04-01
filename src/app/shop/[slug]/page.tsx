export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { products as staticProducts } from '@/lib/products';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { Product } from '@/types';

type Props = { params: Promise<{ slug: string }> };

// ── Helper: resolve product (DB first, then static + overrides) ──
async function resolveProduct(slug: string): Promise<Product | null> {
  try {
    const dbProduct = await prisma.product.findUnique({ where: { slug } });
    if (dbProduct) return dbProduct as unknown as Product;
  } catch {}

  const staticProduct = staticProducts.find(p => p.slug === slug);
  if (!staticProduct) return null;

  try {
    const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
    const overrides = (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};
    const override = overrides[staticProduct.id];
    if (override && Object.keys(override).length > 0) {
      return { ...staticProduct, ...override } as Product;
    }
  } catch {}

  return staticProduct;
}

// ── Open Graph / Twitter metadata for social sharing ──
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';

  try {
    const product = await resolveProduct(slug);
    if (!product) throw new Error('not found');

    const title = product.name || 'منتج';
    const description = product.shortDescription || product.description?.replace(/<[^>]+>/g, '').slice(0, 160) || 'منتج من متجر مسلم ليدر';
    const rawImage = product.images?.[0] || '';
    const imageUrl = rawImage.startsWith('http') ? rawImage : rawImage ? `${baseUrl}${rawImage}` : `${baseUrl}/logo.png`;
    const url = `${baseUrl}/shop/${slug}`;

    return {
      title: `${title} | مسلم ليدر`,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: 'مسلم ليدر',
        images: [
          {
            url: imageUrl,
            width: 800,
            height: 800,
            alt: title,
          },
        ],
        type: 'website',
        locale: 'ar_EG',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
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
