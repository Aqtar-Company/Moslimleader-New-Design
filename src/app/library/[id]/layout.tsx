import type { Metadata } from 'next';
import { canonical, absUrl, bookJsonLd, SITE_URL } from '@/lib/seo';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

interface BookForSeo {
  id: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  cover?: string | null;
  language?: string | null;
  price?: number | null;
  isPublished?: boolean;
  author?: string | null;
}

async function fetchBook(id: string): Promise<BookForSeo | null> {
  try {
    const res = await fetch(`${SITE_URL}/api/books/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.book ?? null) as BookForSeo | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const book = await fetchBook(id);
  if (!book) {
    return {
      title: 'كتاب رقمي | مسلم ليدر',
      description: 'اقرأ الكتب الرقمية الإسلامية للأطفال على منصة مسلم ليدر — كتب تربوية وقصص هادفة بصوت ورسومات راقية.',
      alternates: { canonical: canonical(`/library/${id}`) },
    };
  }

  const title = book.title || 'كتاب رقمي';
  const description = (book.description || `اقرأ "${title}" على منصة مسلم ليدر — كتب رقمية إسلامية للأطفال بمحتوى هادف.`).slice(0, 160);
  const cover = absUrl(book.cover);
  const url = canonical(`/library/${id}`);

  return {
    title: `${title} | كتاب رقمي | مسلم ليدر`,
    description,
    alternates: { canonical: url },
    keywords: [title, 'كتب أطفال إسلامية', 'كتب رقمية', 'مسلم ليدر', 'قصص أطفال'],
    openGraph: {
      title,
      description,
      url,
      siteName: 'مسلم ليدر',
      images: [{ url: cover, width: 800, height: 1200, alt: title }],
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
}

export default async function BookLayout({ params, children }: Props) {
  const { id } = await params;
  const book = await fetchBook(id);
  return (
    <>
      {book && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd({ book })) }}
        />
      )}
      {children}
    </>
  );
}
