export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/jwt';
import { loadReels, absoluteMediaUrl } from '@/lib/free-media-query';
import { reactionSummaries, commentCounts } from '@/lib/free-media-social';
import { SITE_URL, ORG_OG_IMAGE } from '@/lib/seo';
import ReelsViewer from './ReelsViewer';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = Number(params.id);
  const reels = await loadReels().catch(() => []);
  const r = reels.find(x => x.id === id);
  if (!r) return { title: 'ريلز — وسائط مسلم ليدر' };
  const title = `${r.title} — ريلز مسلم ليدر`;
  const description = (r.description || `ريل من وسائط مسلم ليدر${r.category ? ` — ${r.category.name}` : ''}`).slice(0, 160);
  const image = absoluteMediaUrl(r.coverUrl, SITE_URL) ?? ORG_OG_IMAGE;
  return {
    title, description,
    alternates: { canonical: `/media/reels/${r.id}` },
    openGraph: { title, description, url: `/media/reels/${r.id}`, images: [image], type: 'video.other' },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/**
 * The reels viewer, opened AT one reel: the whole list is loaded so the reader swipes on
 * from there in either direction, like every vertical-video app.
 */
export default async function ReelPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const reels = await loadReels();
  const start = reels.findIndex(r => r.id === id);
  if (start === -1) notFound();
  const viewer = await getAuthUser().catch(() => null);
  const ids = reels.map(r => r.id);
  const [reactions, comments] = await Promise.all([
    reactionSummaries(ids, viewer?.userId ?? null).catch(() => new Map()),
    commentCounts(ids).catch(() => new Map()),
  ]);
  return (
    <ReelsViewer
      reels={reels}
      startIndex={start}
      social={Object.fromEntries(ids.map(i => [i, {
        reactions: reactions.get(i) ?? { counts: {}, total: 0, mine: null },
        comments: comments.get(i) ?? 0,
      }]))}
    />
  );
}
