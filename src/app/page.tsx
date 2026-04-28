export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { Product } from '@/types';
import ShopPageClient from './ShopPageClient';

async function getProducts(): Promise<Product[]> {
  try {
    const [dbProducts, overrideSetting] = await Promise.all([
      prisma.product.findMany({ where: { source: 'admin' }, orderBy: { createdAt: 'desc' } }),
      prisma.setting.findUnique({ where: { key: 'product-overrides' } }),
    ]);

    const overrides = (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};

    const merged = staticProducts.map(p => {
      const o = overrides[p.id] ?? {};
      return { ...p, ...o } as Product;
    });

    return [...merged, ...(dbProducts as unknown as Product[])];
  } catch {
    return staticProducts;
  }
}

export default async function ShopPage() {
  const products = await getProducts();
  return <ShopPageClient serverProducts={products} />;
}
