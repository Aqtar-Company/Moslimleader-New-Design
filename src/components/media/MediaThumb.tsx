'use client';
import { formatDuration, type MediaKind } from '@/lib/free-media-shared';
import Icon from './Icon';

/**
 * The picture on a media card: the cover, or — when there is none — a quiet tile in the
 * kind's colour with its icon, so a grid never shows a broken image or a black box.
 * Audio cards carry a small waveform mark so a song never reads as a video.
 */
const TILE: Record<MediaKind, string> = {
  reel:  'from-[#1a1a2e] to-[#3b1f4e] text-white/70',
  video: 'from-[#1a1a2e] to-[#2d2d4e] text-white/70',
  audio: 'from-[#2a2140] to-[#4a3a6b] text-[#F5C518]/80',
  image: 'from-[#fff6dc] to-[#fde7a6] text-[#b4830a]',
  pdf:   'from-[#eef2f7] to-[#dbe3ee] text-[#52627a]',
};

export default function MediaThumb({ kind, coverUrl, title, durationSec, className = '', eager = false }: {
  kind: MediaKind;
  coverUrl: string | null;
  title: string;
  durationSec?: number | null;
  className?: string;
  eager?: boolean;
}) {
  const duration = formatDuration(durationSec);
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${TILE[kind]} ${className}`}>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={title}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={`absolute inset-0 w-full h-full ${kind === 'image' || kind === 'pdf' ? 'object-contain bg-white' : 'object-cover'}`}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon name={kind} size={40} strokeWidth={1.5} />
        </span>
      )}
      {kind === 'audio' && (
        <span className="absolute bottom-1.5 right-1.5 flex items-end gap-[2px] h-4 px-1.5 py-1 rounded-md bg-black/65" aria-hidden>
          {[5, 9, 6, 11, 7].map((h, i) => <span key={i} className="w-[2px] rounded-full bg-[#F5C518]" style={{ height: h }} />)}
        </span>
      )}
      {(kind === 'video' || kind === 'reel') && coverUrl && (
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition" aria-hidden>
          <span className="w-12 h-12 rounded-full bg-black/55 flex items-center justify-center text-white backdrop-blur-sm">
            <Icon name="play" size={22} />
          </span>
        </span>
      )}
      {duration && (
        <span dir="ltr" className="absolute bottom-1.5 left-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-black/75 text-white tabular-nums">
          {duration}
        </span>
      )}
    </div>
  );
}
