'use client';
import { formatDuration, KIND_LABEL, type MediaKind } from '@/lib/free-media-shared';

/**
 * The picture on a media card: the cover, or — when there is none — a quiet tile in the
 * kind's colour with its icon, so a grid never shows a broken image or a black box.
 */
const TILE: Record<MediaKind, string> = {
  video: 'from-[#1a1a2e] to-[#2d2d4e]',
  audio: 'from-[#2a2140] to-[#4a3a6b]',
  image: 'from-[#fff6dc] to-[#fde7a6]',
  pdf:   'from-[#eef2f7] to-[#dbe3ee]',
};

export default function MediaThumb({ kind, coverUrl, title, durationSec, className = '' }: {
  kind: MediaKind;
  coverUrl: string | null;
  title: string;
  durationSec?: number | null;
  className?: string;
}) {
  const duration = formatDuration(durationSec);
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${TILE[kind]} ${className}`}>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          loading="lazy"
          className={`absolute inset-0 w-full h-full ${kind === 'image' || kind === 'pdf' ? 'object-contain bg-white' : 'object-cover'}`}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-80" aria-hidden>{KIND_LABEL[kind].icon}</span>
      )}
      {kind === 'audio' && coverUrl && (
        <span className="absolute bottom-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-md bg-black/70 text-white" aria-hidden>🎧</span>
      )}
      {duration && (
        <span dir="ltr" className="absolute bottom-1.5 left-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-black/75 text-white tabular-nums">
          {duration}
        </span>
      )}
    </div>
  );
}
