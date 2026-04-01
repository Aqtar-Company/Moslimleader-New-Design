export const dynamic = 'force-dynamic';
import { products as staticProducts } from '@/lib/products';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { Product } from '@/types';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Try DB product first (admin-added products)
  try {
    const dbProduct = await prisma.product.findUnique({ where: { slug } });
    if (dbProduct) {
      return <ProductDetailClient product={dbProduct as unknown as Product} />;
    }
  } catch {}

  // Fallback to static products with overrides
  const staticProduct = staticProducts.find(p => p.slug === slug);
  if (!staticProduct) notFound();

  // Apply any admin overrides saved in Settings table
  try {
    const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
    const overrides = (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};
    const override = overrides[staticProduct.id];
    if (override && Object.keys(override).length > 0) {
      return <ProductDetailClient product={{ ...staticProduct, ...override } as Product} />;
    }
  } catch {}

  return <ProductDetailClient product={staticProduct} />;
}
