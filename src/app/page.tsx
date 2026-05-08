import { Metadata } from 'next';
import ShopPageClient from './ShopPageClient';

export const metadata: Metadata = {
  title: 'مسلم ليدر — ألعاب وهدايا إسلامية للأطفال | Moslim Leader',
  description: 'متجر مسلم ليدر لألعاب الأطفال الإسلامية، هدايا تربوية، كتب تعليمية، ومنتجات تعزز الهوية الإسلامية. شحن لكل مصر والعالم العربي.',
  keywords: ['ألعاب إسلامية', 'هدايا أطفال', 'مسلم ليدر', 'Moslim Leader', 'ألعاب تربوية', 'هدايا إسلامية', 'كتب أطفال'],
  openGraph: {
    title: 'مسلم ليدر — ألعاب وهدايا إسلامية للأطفال',
    description: 'اختياراتك اليوم تبنيه غدًا. تسوّق منتجات تربوية تعزز هوية أطفالنا المسلمين.',
    url: 'https://moslimleader.com',
    siteName: 'Moslim Leader',
    locale: 'ar_EG',
    type: 'website',
    images: [{ url: 'https://moslimleader.com/family-hero.webp', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@moslimleader',
    title: 'مسلم ليدر — ألعاب وهدايا إسلامية للأطفال',
    description: 'اختياراتك اليوم تبنيه غدًا. تسوّق منتجات تربوية تعزز هوية أطفالنا المسلمين.',
  },
  alternates: { canonical: 'https://moslimleader.com' },
};

export default function Page() {
  return <ShopPageClient />;
}
