import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getMergedStaticProducts } from '@/lib/product-overrides';
import type { Product } from '@/types';
import CatalogClient from './CatalogClient';

export const metadata: Metadata = {
  title: 'كتالوج مسلم ليدر | منتجاتنا التربوية',
  description: 'تصفح كتالوج مسلم ليدر الكامل — كتب أطفال إسلامية، حقائب مدرسية، ألعاب تعليمية. اطلب مباشرة بضغطة واحدة.',
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

async function getProducts(): Promise<Product[]> {
  try {
    const [mergedStatic, dbProducts] = await Promise.all([
      getMergedStaticProducts(),
      prisma.product.findMany({ where: { source: 'admin', inStock: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    return [...mergedStatic.filter(p => p.inStock !== false), ...(dbProducts as unknown as Product[])];
  } catch {
    try { return await getMergedStaticProducts(); } catch { return []; }
  }
}

export default async function CatalogPage() {
  const products = await getProducts();
  return <CatalogClient products={products} />;
}
