import type { Metadata } from 'next';
import ShopPageClient from './ShopPageClient';
import { canonical, organizationJsonLd, websiteJsonLd, ORG_DESCRIPTION } from '@/lib/seo';
import { getMergedStaticProducts } from '@/lib/product-overrides';
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
  },
};

async function getProducts(): Promise<Product[]> {
  try {
    const [mergedStatic, dbProducts] = await Promise.race([
      Promise.all([
        getMergedStaticProducts(),
        prisma.product.findMany({ where: { source: 'admin' }, orderBy: { createdAt: 'desc' } }),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      ),
    ]);
    return [...mergedStatic, ...(dbProducts as unknown as Product[])];
  } catch {
    try { return await getMergedStaticProducts(); } catch { return staticProducts; }
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
