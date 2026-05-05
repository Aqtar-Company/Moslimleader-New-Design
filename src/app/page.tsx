export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { Product } from '@/types';
import { getMergedStaticProducts } from '@/lib/product-overrides';
import ShopPageClient from './ShopPageClient';

function ProductsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 max-w-md mx-auto">
        <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
      </div>
      <div className="flex gap-2 justify-center mb-10">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-24 bg-gray-100 rounded-full animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="aspect-square bg-gray-100 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-50 rounded w-1/2 animate-pulse" />
              <div className="flex justify-between pt-2">
                <div className="h-5 bg-gray-100 rounded w-16 animate-pulse" />
                <div className="h-8 bg-purple-100 rounded-xl w-20 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function ProductsSection() {
  let products: Product[];
  try {
    const [merged, dbProducts] = await Promise.all([
      getMergedStaticProducts().catch(() => staticProducts),
      prisma.product.findMany({ where: { source: 'admin' }, orderBy: { createdAt: 'desc' } }).catch(() => []),
    ]);
    products = [...merged, ...dbProducts] as Product[];
  } catch (err) {
    console.error('[home getProducts]', err);
    products = staticProducts;
  }

  return <ShopPageClient products={products} heroOnly={false} />;
}

export default function Page() {
  return (
    <>
      <ShopPageClient products={[]} heroOnly={true} />
      <Suspense fallback={<ProductsSkeleton />}>
        {/* @ts-expect-error async server component */}
        <ProductsSection />
      </Suspense>
    </>
  );
}
