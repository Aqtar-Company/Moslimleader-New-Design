export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { Product } from '@/types';
import { getMergedStaticProducts } from '@/lib/product-overrides';
import ShopPageClient from './ShopPageClient';
import HomeLoading from './loading';

const SSR_BUDGET_MS = 3000;

// Fetch the full home-page product list within a strict 3-second budget.
// On timeout or DB error, we fall back to the cached overrides (if any)
// and finally to the raw static catalogue, so the page always renders
// fast — never blocking on a slow DB.
async function getProducts(): Promise<Product[]> {
  const dbProductsP = prisma.product
    .findMany({ where: { source: 'admin' }, orderBy: { createdAt: 'desc' } })
    .catch(err => {
      console.error('[home dbProducts]', err);
      return [] as Awaited<ReturnType<typeof prisma.product.findMany>>;
    });
  const mergedStaticP = getMergedStaticProducts().catch(err => {
    console.error('[home mergedStatic]', err);
    return staticProducts;
  });

  const timeout = new Promise<'timeout'>(resolve =>
    setTimeout(() => resolve('timeout'), SSR_BUDGET_MS),
  );
  const work = Promise.all([mergedStaticP, dbProductsP]).then(([m, d]) => ({
    merged: m,
    db: d,
  }));

  const result = await Promise.race([work, timeout]);
  if (result === 'timeout') {
    console.error('[home getProducts] SSR exceeded 3s budget — falling back');
    // Helper has its own warm cache; use it. If empty, use raw statics.
    const merged = await getMergedStaticProducts().catch(() => staticProducts);
    return merged as Product[];
  }
  return [...result.merged, ...result.db] as Product[];
}

export default async function Page() {
  const products = await getProducts();

  return (
    <Suspense fallback={<HomeLoading />}>
      <ShopPageClient products={products} />
    </Suspense>
  );
}
