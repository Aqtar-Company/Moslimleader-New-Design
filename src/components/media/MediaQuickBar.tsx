'use client';
import { useEffect, useState } from 'react';
import MediaReactions, { type Summary } from './MediaReactions';
import { COMMENT_EVENT } from './MediaEngage';
import Icon from './Icon';
import MediaQuickComment from './MediaQuickComment';

/**
 * The slim strip ON the media box: react in one tap, and a comment button that takes you to
 * «شاركنا رأيك» and opens the writer. Short on purpose — the full block lives under the
 * player; this is the part people see without scrolling.
 *
 * `tone="dark"` is for over a picture or a video (ghost pills on dark); the summary stays in
 * step with the block through MediaReactions' broadcast.
 */
const EMPTY: Summary = { counts: {}, total: 0, mine: null };

export default function MediaQuickBar({ mediaId, isEn, initialReactions, commentCount, tone = 'dark', writer = true }: {
  /** The one-line comment box under the bar. Off where the page puts it elsewhere (an
   *  audio cover has no room for it: AudioStage carries it in its `below` strip). */
  writer?: boolean;
  mediaId: number;
  isEn: boolean;
  initialReactions?: Summary;
  /** Shown only when the page knows the real count. */
  commentCount?: number;
  tone?: 'dark' | 'light';
}) {
  const [count, setCount] = useState(commentCount);
  useEffect(() => { setCount(commentCount); }, [commentCount, mediaId]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: number; delta: number }>).detail;
      if (d?.id === mediaId) setCount(c => (c === undefined ? c : Math.max(0, c + d.delta)));
    };
    window.addEventListener(COMMENT_EVENT, on);
    return () => window.removeEventListener(COMMENT_EVENT, on);
  }, [mediaId]);

  // The box to write in is right here (MediaQuickComment); this button takes you to the
  // conversation — the list in «شاركنا رأيك».
  const goComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    document.getElementById(`engage-${mediaId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const dark = tone === 'dark';
  const bar = (
    <div className="flex items-center justify-between gap-2" dir={isEn ? 'ltr' : 'rtl'} onClick={e => e.stopPropagation()}>
      <MediaReactions mediaId={mediaId} initial={initialReactions ?? EMPTY} isEn={isEn} layout="bar" tone={tone} />
      <button
        type="button"
        onClick={goComments}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${dark ? 'border-white/35 bg-black/25 text-white hover:bg-black/45 backdrop-blur' : 'border-gray-300 text-[#1a1a2e] hover:bg-gray-50'}`}
      >
        <Icon name="comment" size={15} />
        {isEn ? 'Comments' : 'التعليقات'}
        {count !== undefined && count > 0 && <span className={`tabular-nums ${dark ? 'text-white/75' : 'text-gray-500'}`}>{count}</span>}
      </button>
    </div>
  );
  if (!writer) return bar;
  return (
    <div className="flex flex-col gap-2">
      {bar}
      <MediaQuickComment mediaId={mediaId} isEn={isEn} tone={tone} />
    </div>
  );
}
