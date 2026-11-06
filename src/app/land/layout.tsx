import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'أرض القائد المسلم | Moslim Leader Land',
  description:
    'أرض القائد المسلم — مشروع مستقبلي لمكان كبير للأسرة المسلمة: سينما وحكايات، ألعاب وملاهٍ تحترم الهوية، كشافة ومغامرة، نادي البنات والسيدات، وملتقى للأسرة ومركز للفتوى والإرشاد.',
  alternates: { canonical: canonical('/land') },
  openGraph: {
    title: 'أرض القائد المسلم — Moslim Leader Land',
    description: 'مكان كبير للأسرة المسلمة، لا يكفي يوم واحد لتغطيته. تصوّر مبدئي لمشروع مستقبلي.',
    url: canonical('/land'),
    siteName: 'مسلم ليدر',
    images: ['/partnership/land-stories.webp'],
    type: 'website',
    locale: 'ar_EG',
  },
};

export default function LandLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
