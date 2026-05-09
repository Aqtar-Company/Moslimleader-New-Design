import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'عن مسلم ليدر | منتجات تربوية إسلامية للأطفال',
  description:
    'عن مسلم ليدر — مشروع تربوي يقدّم كتب وألعاب ومنتجات للأطفال تغرس القيم الإسلامية والانتماء بأسلوب راقٍ يناسب الأمهات اللي بيربّو قادة الغد.',
  alternates: { canonical: canonical('/about') },
  openGraph: {
    title: 'عن مسلم ليدر',
    description: 'مشروع تربوي إسلامي للأطفال — كتب، ألعاب، حقائب، وهدايا تنمي القيم.',
    url: canonical('/about'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
