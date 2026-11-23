import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';
import { serverLang } from '@/lib/server-lang';

const AR: Metadata = {
  title: 'تواصل معنا | مسلم ليدر',
  description: 'تواصل مع فريق مسلم ليدر — واتساب، إيميل، Messenger، إنستجرام. ابعت رسالتك من النموذج وهنرد عليك خلال 24 ساعة.',
  openGraph: {
    title: 'تواصل معنا | مسلم ليدر',
    description: 'فريق مسلم ليدر مستعد للرد على أي استفسار.',
    url: canonical('/contact'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
  },
};

const EN: Metadata = {
  title: 'Contact us | Moslim Leader',
  description: 'Contact the Moslim Leader team — WhatsApp, email, Messenger, Instagram. Send us a message and we reply within 24 hours.',
  openGraph: {
    title: 'Contact us | Moslim Leader',
    description: 'The Moslim Leader team is ready to answer any question.',
    url: canonical('/en/contact'),
    siteName: 'Moslim Leader',
    type: 'website',
    locale: 'en_US',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return serverLang() === 'en' ? EN : AR;
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
