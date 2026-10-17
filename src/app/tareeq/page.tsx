export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import TareeqClient from './TareeqClient';
import { getAuthUser } from '@/lib/jwt';
import { forYouPage, loadFeedExclusions } from '@/lib/tareeq-feed';

export const metadata: Metadata = {
  title: 'طريق',
  description: 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — شارك تجربتك واترك علامة يهتدي بها غيرك',
  openGraph: {
    title: 'طريق',
    description: 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — شارك تجربتك واترك علامة يهتدي بها غيرك',
    url: 'https://moslimleader.com/tareeq',
    siteName: 'مسلم ليدر',
    locale: 'ar_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'طريق',
    description: 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — شارك تجربتك واترك علامة يهتدي بها غيرك',
  },
};

export default async function TareeqPage() {
  let initialPosts: any[] = [];
  let initialCursor: string | null = null;

  // The first page of «لك», ranked for THIS reader with their blocks, mutes and hidden
  // posts applied — the same function the client calls for every page after it. This
  // used to be a plain newest-first query with no exclusions: the tab said «لك» while the
  // screen showed «جديد», and a post hidden a moment ago reappeared on reload.
  try {
    const viewer = await getAuthUser().catch(() => null);
    const viewerId = viewer?.userId ?? null;
    const excl = await loadFeedExclusions(viewerId);
    const page = await forYouPage({ viewerId, limit: 12, excl });
    initialPosts = page.posts;
    initialCursor = page.nextCursor;
  } catch { /* show empty state; the client can still load */ }

  return (
    <TareeqClient
      initialPosts={initialPosts.map(p => ({
        ...p,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        postUpdateAt: p.postUpdateAt instanceof Date ? p.postUpdateAt.toISOString() : (p.postUpdateAt ?? null),
      }))}
      initialCursor={initialCursor}
    />
  );
}
