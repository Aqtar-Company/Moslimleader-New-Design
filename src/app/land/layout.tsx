import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'أرض القائد المسلم | Moslim Leader Land',
  description:
    'أرض القائد المسلم — نبني أكبر وجهة ترويحية للأسرة المسلمة في العالم: تدخلها الأسرة لتستريح، وتخرج منها أشدّ تماسكاً وأوسع فكراً. لكل فرد فيها ما يخصه، وفي كل ركن مسجد.',
  alternates: { canonical: canonical('/land') },
  openGraph: {
    title: 'أرض القائد المسلم — Moslim Leader Land',
    description: '«روّحوا القلوبَ ساعةً بعد ساعة» — أكبر وجهة ترويحية للأسرة المسلمة في العالم. تصوّر مبدئي لمشروع مستقبلي.',
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
