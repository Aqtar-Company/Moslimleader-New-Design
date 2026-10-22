export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/jwt';
import { reactionSummaries, commentCounts } from '@/lib/free-media-social';
import { loadMediaItem, absoluteMediaUrl } from '@/lib/free-media-query';
import { SITE_URL, ORG_OG_IMAGE } from '@/lib/seo';
import { KIND_LABEL } from '@/lib/free-media-shared';
import MediaWatch from './MediaWatch';

function cut(s: string, n: number) {
  if (s.length <= n) return s;
  const head = s.slice(0, n);
  const sp = head.lastIndexOf(' ');
  return `${(sp > n * 0.6 ? head.slice(0, sp) : head).trim()}…`;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = Number(params.id);
  const data = Number.isInteger(id) ? await loadMediaItem(id).catch(() => null) : null;
  if (!data) return { title: 'وسائط مسلم ليدر' };
  const { item } = data;
  const title = `${item.title} — وسائط مسلم ليدر`;
  const description = cut(item.description || `${KIND_LABEL[item.kind].ar} مجاني من مسلم ليدر${item.category ? ` — ${item.category.name}` : ''}`, 160);
  // The picture a shared link shows: the item's cover (a drawing is its own picture).
  const image = absoluteMediaUrl(item.coverUrl ?? (item.kind === 'image' ? item.url : null), SITE_URL) ?? ORG_OG_IMAGE;
  return {
    title,
    description,
    alternates: { canonical: `/media/${item.id}` },
    openGraph: {
      title, description, url: `/media/${item.id}`, images: [image],
      type: item.kind === 'video' ? 'video.other' : item.kind === 'audio' ? 'music.song' : 'website',
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function MediaItemPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const data = await loadMediaItem(id);
  if (!data) notFound();
  // A reel lives in the swipe viewer; an old /media/<id> link to one lands there.
  if (data.item.kind === 'reel') redirect(`/media/reels/${id}`);
  const viewer = await getAuthUser().catch(() => null);
  const [reactions, comments] = await Promise.all([
    reactionSummaries([id], viewer?.userId ?? null).catch(() => new Map()),
    commentCounts([id]).catch(() => new Map()),
  ]);
  return (
    <MediaWatch
      item={data.item}
      upNext={data.upNext}
      reactions={reactions.get(id) ?? { counts: {}, total: 0, mine: null }}
      commentCount={comments.get(id) ?? 0}
    />
  );
}
