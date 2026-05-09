import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'تواصل معنا | مسلم ليدر',
  description: 'تواصل مع فريق مسلم ليدر — واتساب، إيميل، Messenger، إنستجرام. ابعت رسالتك من النموذج وهنرد عليك خلال 24 ساعة.',
  alternates: { canonical: canonical('/contact') },
  openGraph: {
    title: 'تواصل معنا | مسلم ليدر',
    description: 'فريق مسلم ليدر مستعد للرد على أي استفسار.',
    url: canonical('/contact'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
