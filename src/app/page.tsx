export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import ShopPageClient from './ShopPageClient';
import { canonical, organizationJsonLd, websiteJsonLd, ORG_DESCRIPTION, ORG_OG_IMAGE } from '@/lib/seo';
import { getMergedStaticProducts, loadProductOrder, applyProductOrder, orderProducts } from '@/lib/product-overrides';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import type { Product } from '@/types';

export const metadata: Metadata = {
  title: 'مسلم ليدر | متجر تربوي إسلامي للأطفال — كتب وألعاب ومنتجات راقية',
  description:
    'متجر مسلم ليدر — كتب أطفال إسلامية، حقائب مدرسية، ألعاب تعليمية وهدايا تربّي القيم وتغرس الانتماء. توصيل لكل محافظات مصر والوطن العربي.',
  alternates: { canonical: canonical('/') },
  keywords: [
    'كتب أطفال إسلامية',
    'حقائب مدرسية',
    'ألعاب تعليمية للأطفال',
    'منتجات تربوية',
    'هدايا أطفال',
    'مسلم ليدر',
  ],
  openGraph: {
    title: 'مسلم ليدر | منتجات تربوية إسلامية للأطفال',
    description: ORG_DESCRIPTION,
    url: canonical('/'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
    images: [{ url: ORG_OG_IMAGE, width: 512, height: 512, alt: 'مسلم ليدر' }],
  },
};

async function getProducts(): Promise<Product[]> {
  try {
    // The order list is read INSIDE the 3s race like everything else — a fourth query
    // outside it would let a slow database hold the page past the deadline.
    const [mergedStatic, dbProducts, order] = await Promise.race([
      Promise.all([
        getMergedStaticProducts(),
        prisma.product.findMany({ where: { source: 'admin' }, orderBy: { createdAt: 'desc' } }),
        loadProductOrder(),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      ),
    ]);
    // Static first, admin-added after — the SAME natural order as /api/products, the
    // catalog and the admin list. It was the other way round here, so a product not yet in
    // the admin's list sat at the bottom of the admin table and at the top of the home
    // page, and "the order here is the order in the shop" was untrue for exactly the
    // products the fallback exists for. The admin's list then decides everything listed.
    return applyProductOrder([...mergedStatic, ...(dbProducts as unknown as Product[])], order);
  } catch {
    try { return await orderProducts(await getMergedStaticProducts()); } catch { return staticProducts; }
  }
}

export default async function Page() {
  const products = await getProducts();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <ShopPageClient initialProducts={products} />
    </>
  );
}
