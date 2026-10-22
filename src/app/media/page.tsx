export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { loadMediaHero, loadMediaLibrary } from '@/lib/free-media-query';
import MediaBrowser from './MediaBrowser';

export const metadata: Metadata = {
  title: 'وسائط مسلم ليدر — أناشيد وقصص وفيديوهات ورسومات مجانية',
  description: 'مكتبة مسلم ليدر المجانية: أناشيد، قصص قبل النوم، فيديوهات ورسومات تلوين للأطفال — شاهد واستمع مجاناً، وحمّل بعد إنشاء حساب.',
  alternates: { canonical: '/media' },
  openGraph: {
    title: 'وسائط مسلم ليدر المجانية',
    description: 'أناشيد، قصص قبل النوم، فيديوهات ورسومات تلوين — مجاناً.',
    url: '/media',
    type: 'website',
  },
};

export default async function MediaPage() {
  // A failed read shows the empty state, never an error page: this is a public landing.
  const [data, heroUrl] = await Promise.all([
    loadMediaLibrary().catch(() => ({ items: [], categories: [] })),
    loadMediaHero().catch(() => null),
  ]);
  return <MediaBrowser items={data.items} categories={data.categories} heroUrl={heroUrl} />;
}
