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
  // Load admin overrides once (applies to both DB-seeded and pure static products)
  let overrides: Record<string, Record<string, unknown>> = {};
  try {
    const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
    overrides = (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};
  } catch {}

  try {
    const dbProduct = await prisma.product.findUnique({ where: { slug } });
    if (dbProduct) {
      // Static-sourced products in DB may have stale prices — apply overrides
      if (dbProduct.source === 'static') {
        const override = overrides[dbProduct.id];
        if (override && Object.keys(override).length > 0) {
          return { ...dbProduct, ...override } as unknown as Product;
        }
      }
      return dbProduct as unknown as Product;
    }
  } catch {}

  const staticProduct = staticProducts.find(p => p.slug === slug);
  if (!staticProduct) return null;

  const override = overrides[staticProduct.id];
  if (override && Object.keys(override).length > 0) {
    return { ...staticProduct, ...override } as Product;
  }

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
