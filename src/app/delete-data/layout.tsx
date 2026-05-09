import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'طلب حذف البيانات | Data Deletion | مسلم ليدر',
  description: 'Request deletion of your data from Moslim Leader AI Assistant. طلب حذف البيانات المرتبطة بمحادثاتك على Messenger أو التعليقات.',
  alternates: { canonical: canonical('/delete-data') },
  robots: { index: true, follow: true }, // FB review needs to find it
  openGraph: {
    title: 'Data Deletion | حذف البيانات',
    description: 'Submit a data deletion request to Moslim Leader.',
    url: canonical('/delete-data'),
    siteName: 'مسلم ليدر',
    type: 'website',
    locale: 'ar_EG',
  },
};

export default function DeleteDataLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
