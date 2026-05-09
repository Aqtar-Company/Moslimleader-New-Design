import type { Metadata } from 'next';
import ShopPageClient from './ShopPageClient';
import { canonical, organizationJsonLd, websiteJsonLd, ORG_DESCRIPTION } from '@/lib/seo';

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

export default function Page() {
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
      <ShopPageClient />
    </>
  );
}
