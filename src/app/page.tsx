export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { Product } from '@/types';
import ShopPageClient from './ShopPageClient';
import HomeLoading from './loading';

async function getProducts(): Promise<Product[]> {
  try {
    const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
    const overrides = (overrideSetting?.value ?? {}) as Record<string, Record<string, unknown>>;

    const staticWithOverrides = staticProducts.map(p => {
      const override = overrides[p.id] ?? {};
      const merged = { ...p, ...override };
      const regional = (merged as { regionalPricing?: { price_usd_manual?: number; price_egp_manual?: number } }).regionalPricing;
      const hasExplicitPriceUsd = override.priceUsd !== undefined && (override.priceUsd as number) > 0;
      if (!hasExplicitPriceUsd && (!merged.priceUsd || (merged.priceUsd as number) === 0) && regional?.price_usd_manual) {
        (merged as Record<string, unknown>).priceUsd = regional.price_usd_manual;
      }
      const hasExplicitPrice = override.price !== undefined && (override.price as number) > 0;
      if (!hasExplicitPrice && regional?.price_egp_manual && regional.price_egp_manual > 0) {
        (merged as Record<string, unknown>).price = regional.price_egp_manual;
      }
      return merged;
    });

    const activeStatic = staticWithOverrides.filter(p => !(p as Record<string, unknown>)._deleted);

    const dbProducts = await prisma.product.findMany({
      where: { source: 'admin' },
      orderBy: { createdAt: 'desc' },
    });

    return [...activeStatic, ...dbProducts] as Product[];
  } catch (err) {
    console.error('[home getProducts]', err);
    return staticProducts;
  }
}

export default async function Page() {
  const products = await getProducts();

  return (
    <Suspense fallback={<HomeLoading />}>
      <ShopPageClient products={products} />
    </Suspense>
  );
}
