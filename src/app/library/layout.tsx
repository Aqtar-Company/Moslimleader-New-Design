import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';

// Library list metadata. Helps Google distinguish the public catalogue
// page (/library) from the per-book detail pages (/library/[id]).
export const metadata: Metadata = {
  title: 'المكتبة الرقمية | كتب أطفال إسلامية مصوَّرة — مسلم ليدر',
  description:
    'مكتبة مسلم ليدر الرقمية — كتب أطفال إسلامية مصوَّرة وقصص هادفة بصياغة بسيطة وعصرية. تصفح صفحات مجانية لكل كتاب قبل الشراء.',
  alternates: { canonical: canonical('/library') },
  keywords: ['مكتبة أطفال', 'كتب أطفال إسلامية', 'قصص أطفال', 'كتب رقمية', 'مسلم ليدر'],
  openGraph: {
    title: 'المكتبة الرقمية | مسلم ليدر',
    description: 'كتب أطفال إسلامية مصوَّرة وقصص هادفة على منصة مسلم ليدر.',
    url: canonical('/library'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
  },
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
