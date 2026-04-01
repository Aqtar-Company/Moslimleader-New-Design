import type { Metadata } from 'next';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
    const res = await fetch(`${baseUrl}/api/books/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    const book = data.book;
    if (!book) throw new Error('no book');

    const title = book.title || 'كتاب رقمي';
    const description = book.description || 'اقرأ هذا الكتاب على منصة مسلم ليدر';
    const rawCover = book.cover || '';
    const cover = rawCover.startsWith('http') ? rawCover : rawCover ? `${baseUrl}${rawCover}` : `${baseUrl}/logo.png`;
    const url = `${baseUrl}/library/${id}`;

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

export default async function BookLayout({ params, children }: Props) {
  await params; // ensure params is resolved
  return <>{children}</>;
}
