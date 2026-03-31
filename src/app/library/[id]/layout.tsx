import type { Metadata } from 'next';

interface Props {
  params: { id: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
    const res = await fetch(`${baseUrl}/api/books/${params.id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    const book = data.book;
    if (!book) throw new Error('no book');

    const title = book.title || 'كتاب رقمي';
    const description = book.description || 'اقرأ هذا الكتاب على منصة مسلم ليدر';
    const cover = book.cover || `${baseUrl}/logo.png`;
    const url = `${baseUrl}/library/${params.id}`;

    return {
      title: `${title} | مسلم ليدر`,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: 'مسلم ليدر',
        images: [
          {
            url: cover,
            width: 800,
            height: 1200,
            alt: title,
          },
        ],
        type: 'book',
        locale: 'ar_EG',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [cover],
      },
    };
  } catch {
    return {
      title: 'كتاب رقمي | مسلم ليدر',
      description: 'اقرأ الكتب الرقمية على منصة مسلم ليدر',
    };
  }
}

export default function BookLayout({ children }: Props) {
  return <>{children}</>;
}
