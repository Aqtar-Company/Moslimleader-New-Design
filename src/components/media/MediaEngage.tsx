'use client';
import { useEffect, useState } from 'react';
import MediaReactions, { broadcastReactions, type Summary } from './MediaReactions';
import MediaComments from './MediaComments';
import Icon from './Icon';

/**
 * «شاركنا رأيك» — reactions and comments for one item, as a block that is SEEN: a heading,
 * the reaction button with a line saying what it is for, and a writer with a prompt.
 * Listeners did not notice that reacting or commenting was possible when the only way in
 * was a pill among the action buttons; this block sits under the player instead.
 *
 * Reactions are fetched here (GET /api/media/[id]/reactions) unless the page already has
 * them; remounting with `key={id}` resets it for the next item of a playlist.
 */
const EMPTY: Summary = { counts: {}, total: 0, mine: null };
/** Comment added (+1) / removed (-1), for the count on the player's bar. */
export const COMMENT_EVENT = 'ml-media-comment';

export default function MediaEngage({ mediaId, isEn, initialReactions, initialCount, onCount }: {
  mediaId: number;
  isEn: boolean;
  initialReactions?: Summary;
  initialCount?: number;
  onCount?: (delta: number) => void;
}) {
  const t = (ar: string, en: string) => (isEn ? en : ar);
  const [reactions, setReactions] = useState<Summary>(initialReactions ?? EMPTY);
  // A count is shown only when the page knows the real one; a playlist does not, and
  // counting just this visit's comments would understate it.
  const knowsCount = initialCount !== undefined;
  const [count, setCount] = useState(initialCount ?? 0);

  useEffect(() => {
    if (initialReactions) return;
    fetch(`/api/media/${mediaId}/reactions`, { signal: AbortSignal.timeout(10_000) })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setReactions(d); broadcastReactions(mediaId, d); } })
      .catch(() => {});
  }, [mediaId, initialReactions]);

  return (
    <section className="rounded-2xl bg-white border-2 border-[#F5C518]/40 p-4 sm:p-5" aria-labelledby={`engage-${mediaId}`}>
      <h2 id={`engage-${mediaId}`} className="font-black text-[#1a1a2e] text-lg flex items-center gap-2">
        <Icon name="comment" size={22} /> {t('شاركنا رأيك', 'Tell us what you think')}
        {knowsCount && count > 0 && <span className="text-sm text-gray-400 font-bold tabular-nums">· {count} {t('تعليق', count === 1 ? 'comment' : 'comments')}</span>}
      </h2>

      <div className="mt-3 mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[#FAF8F3] px-3 py-2.5">
        <MediaReactions mediaId={mediaId} initial={reactions} isEn={isEn} />
        <span className="text-xs text-gray-500">{t('اضغط «تفاعل» واختر ما يعبّر عنك', 'Tap «React» and pick what fits')}</span>
      </div>

      <MediaComments
        mediaId={mediaId}
        isEn={isEn}
        prominent
        onCount={d => {
          setCount(c => Math.max(0, c + d));
          onCount?.(d);
          window.dispatchEvent(new CustomEvent(COMMENT_EVENT, { detail: { id: mediaId, delta: d } }));
        }}
      />
    </section>
  );
}
