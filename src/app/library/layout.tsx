import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'المكتبة الرقمية — كتب إسلامية للأطفال',
  description: 'مكتبة مسلم ليدر الرقمية — كتب تعليمية وقصص إسلامية للأطفال. اقرأ، تعلّم، وانمُ مع أطفالك.',
  openGraph: {
    title: 'المكتبة الرقمية — مسلم ليدر',
    description: 'كتب تعليمية وقصص إسلامية للأطفال — اقرأ مباشرة من المتصفح.',
    url: 'https://moslimleader.com/library',
    images: [{ url: 'https://moslimleader.com/library-hero.jpg', width: 1200, height: 630 }],
  },
  alternates: { canonical: 'https://moslimleader.com/library' },
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
