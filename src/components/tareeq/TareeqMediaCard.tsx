'use client';
import { useRef } from 'react';
import TareeqVideo from './TareeqVideo';
import AudioStage from '@/components/media/AudioStage';
import type { PostMedia } from '@/lib/post-media';
import { TYPE_TO_KIND, KIND_LABEL, formatDuration, mediaPath, mediaThumbUrl } from '@/lib/free-media-shared';

/**
 * An item of the media library inside a طريق post: it plays HERE, in the feed, and a link
 * underneath opens it in the library (where the playlist, download and sleep timer are).
 *
 * Every element that can be pressed stops propagation, because the text card it sits in
 * opens the post on a click — pressing play must not navigate away.
 */
export default function TareeqMediaCard({ media, isRtl, compact = false }: {
  media: PostMedia | null | undefined;
  isRtl: boolean;
  /** Inside a shared original: smaller picture, same controls. */
  compact?: boolean;
}) {
  const counted = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  if (!media || !media.isPublished) return null;

  const kind = TYPE_TO_KIND[media.type] ?? 'video';
  const title = !isRtl && media.titleEn ? media.titleEn : media.title;
  const href = mediaPath(media.id, kind);
  const duration = formatDuration(media.durationSec);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  // Not <a>: a shared original sits inside the share's own link, and an <a> inside an <a>
  // is invalid HTML that the browser re-parents — the page then fails to hydrate.
  const go = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); window.location.href = href; };
  const linkProps = {
    role: 'link' as const, tabIndex: 0, onClick: go,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') go(e); },
  };
  // One view per card, the same counter the library itself uses.
  const onPlay = () => {
    if (counted.current) return;
    counted.current = true;
    void fetch(`/api/media/${media.id}/view`, { method: 'POST' }).catch(() => {});
  };
  // A feed holds several stories; starting one stops the one already playing.
  const onPlayAudio = (el: HTMLAudioElement | null) => {
    document.querySelectorAll('audio').forEach(a => { if (a !== el && !a.paused) a.pause(); });
    onPlay();
  };

  const label = isRtl ? KIND_LABEL[kind].one : kind === 'audio' ? 'Audio' : kind === 'image' ? 'Drawing' : kind === 'pdf' ? 'PDF' : kind === 'reel' ? 'Reel' : 'Video';

  let body: React.ReactNode;
  if (kind === 'video' || kind === 'reel') {
    body = (
      <TareeqVideo
        src={media.url}
        poster={media.coverUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        onPlay={onPlay}
        style={{
          width: '100%', display: 'block', background: '#000',
          ...(kind === 'reel'
            ? { aspectRatio: '9 / 16', maxHeight: compact ? 360 : 520, objectFit: 'contain' as const }
            : { maxHeight: compact ? 260 : 460 }),
        }}
      />
    );
  } else if (kind === 'audio') {
    // The library's own player (cover large, waveform as the seek bar, big play button):
    // a story in the feed must look like something to LISTEN to, not a file with a control
    // strip. The library strip is attached under it, inside the same dark box.
    const wave = Array.isArray(media.waveform) && media.waveform.every(n => typeof n === 'number') ? media.waveform as number[] : null;
    const cat = media.category ? (!isRtl && media.category.nameEn ? media.category.nameEn : media.category.name) : null;
    return (
      <div className={compact ? 'mt-0' : 'mt-3'} onClick={stop}>
        <AudioStage
          ref={audioRef}
          src={media.url}
          coverUrl={media.coverUrl}
          title={title}
          label={cat ?? label}
          waveform={wave}
          durationSec={media.durationSec}
          isEn={!isRtl}
          onPlay={() => onPlayAudio(audioRef.current)}
          onEnded={() => {}}
          below={
            <div className="flex items-center gap-2 text-[11.5px] text-white/65">
              <span className="font-bold shrink-0 text-[#F5C518]">{isRtl ? 'مكتبة الوسائط' : 'Media library'}</span>
              {duration && <><span aria-hidden>·</span><span dir="ltr" className="tabular-nums">{duration}</span></>}
              <span
                {...linkProps}
                className="ms-auto shrink-0 inline-flex items-center gap-1 font-bold rounded-full px-3 py-1.5 cursor-pointer bg-white/10 hover:bg-white/20 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]"
              >
                {isRtl ? 'افتح في المكتبة' : 'Open in library'}
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }} aria-hidden><path d="M7 17 17 7M8 7h9v9" /></svg>
              </span>
            </div>
          }
        />
      </div>
    );
  } else if (kind === 'image') {
    body = (
      <span {...linkProps} className="block cursor-pointer" style={{ background: 'var(--tr-raised)' }}>
        <img src={media.previewUrl ?? media.coverUrl ?? media.url} alt={title} loading="lazy" className="w-full object-contain" style={{ maxHeight: compact ? 260 : 480 }} />
      </span>
    );
  } else {
    body = (
      <span {...linkProps} className="flex items-center gap-3 p-3 cursor-pointer" style={{ background: 'var(--tr-raised)' }}>
        {media.coverUrl
          ? <img src={mediaThumbUrl(media.coverUrl, 320) ?? media.coverUrl} alt="" loading="lazy" className="w-16 h-20 shrink-0 rounded-lg object-cover" />
          : <span className="w-16 h-20 shrink-0 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: '#1a1a2e', color: '#F5C518' }}>PDF</span>}
        <span className="text-[13.5px] font-bold leading-snug line-clamp-3" style={{ color: 'var(--tr-text-primary)' }}>{title}</span>
      </span>
    );
  }

  return (
    <div
      className={`${compact ? 'mt-0' : 'mt-3'} rounded-2xl overflow-hidden`}
      style={{ border: '1px solid var(--tr-border-soft)' }}
      onClick={stop}
    >
      {body}
      <div className="flex items-center gap-2 px-3 py-2 text-[11.5px]" style={{ borderTop: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-muted)' }}>
        <span className="font-bold shrink-0" style={{ color: 'var(--tr-gold)' }}>{isRtl ? 'مكتبة الوسائط' : 'Media library'}</span>
        <span aria-hidden>·</span>
        <span className="truncate">
          {/* A PDF carries its title in the body; a picture or a video does not. (Audio has its own player and strip above.) */}
          {kind === 'pdf' ? label : title}
          {duration && <> · <span dir="ltr" className="tabular-nums">{duration}</span></>}
        </span>
        <span
          {...linkProps}
          className="ms-auto shrink-0 inline-flex items-center gap-1 font-bold rounded-full px-2.5 py-1 cursor-pointer focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--tr-text-primary)', background: 'var(--tr-overlay)' }}
        >
          {isRtl ? 'افتح في المكتبة' : 'Open in library'}
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }} aria-hidden><path d="M7 17 17 7M8 7h9v9" /></svg>
        </span>
      </div>
    </div>
  );
}
