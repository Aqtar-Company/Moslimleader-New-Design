'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { formatDuration } from '@/lib/free-media-shared';
import type { PublicMediaItem } from '@/lib/free-media-query';
import MediaThumb from '@/components/media/MediaThumb';
import Icon from '@/components/media/Icon';
import AudioStage from '@/components/media/AudioStage';
import MediaShareSheet from '@/components/media/MediaShareSheet';
import { useMediaDownload } from '@/components/media/useMediaDownload';

/**
 * The audio and video tabs of /media open straight on a player: the first item of the
 * chosen category, with the rest of the category as a playlist beside it (below it on a
 * phone). Picking an item plays it here, without leaving the page; when one ends the next
 * starts, as a playlist does. The grid of cells is one tap away (the toggle in
 * MediaBrowser), and each item's own page — comments, reactions, sleep timer — is linked.
 *
 * «تشغيل تلقائي» shares its stored switch with the item page (`ml-media-autoplay`).
 */
const AUTOPLAY_KEY = 'ml-media-autoplay';

export default function MediaPlaylist({ items, current, onPick, isEn }: {
  items: PublicMediaItem[];
  current: PublicMediaItem;
  onPick: (id: number) => void;
  isEn: boolean;
}) {
  const t = (ar: string, en: string) => (isEn ? en : ar);
  const { user } = useAuth();
  const download = useMediaDownload();
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Set when the reader picked an item or the previous one ended: the new one should PLAY,
  // not just load. A first visit loads the first item and waits for a tap.
  const startNext = useRef(false);
  const counted = useRef(new Set<number>());
  const [autoplay, setAutoplay] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  const at = items.findIndex(i => i.id === current.id);
  const next = at >= 0 && at < items.length - 1 ? items[at + 1] : null;
  const prev = at > 0 ? items[at - 1] : null;
  const title = isEn && current.titleEn ? current.titleEn : current.title;
  const catName = current.category ? (isEn && current.category.nameEn ? current.category.nameEn : current.category.name) : null;

  useEffect(() => {
    try { const v = localStorage.getItem(AUTOPLAY_KEY); if (v !== null) setAutoplay(v === '1'); } catch { /* private mode */ }
  }, []);

  const pick = (id: number) => { startNext.current = true; onPick(id); };

  useEffect(() => {
    if (startNext.current) { startNext.current = false; void mediaRef.current?.play().catch(() => {}); }
    // Keep the playing row in view inside the list — the list scrolls, never the page.
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-id="${current.id}"]`);
    if (list && row && list.scrollHeight > list.clientHeight) {
      list.scrollTo({ top: row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2, behavior: 'smooth' });
    }
  }, [current.id]);

  const onPlay = () => {
    if (counted.current.has(current.id)) return;
    counted.current.add(current.id);
    void fetch(`/api/media/${current.id}/view`, { method: 'POST' }).catch(() => {});
  };
  const onEnded = () => { if (autoplay && next) pick(next.id); };

  // Lock-screen controls: title, cover, and next/previous through the playlist.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title, artist: 'مسلم ليدر', album: catName ?? '',
        ...(current.coverUrl ? { artwork: [{ src: current.coverUrl }] } : {}),
      });
      navigator.mediaSession.setActionHandler('nexttrack', next ? () => pick(next.id) : null);
      navigator.mediaSession.setActionHandler('previoustrack', prev ? () => pick(prev.id) : null);
    } catch { /* older browsers */ }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAutoplay = () => setAutoplay(v => {
    try { localStorage.setItem(AUTOPLAY_KEY, v ? '0' : '1'); } catch { /* ignore */ }
    return !v;
  });

  const pill = 'inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518]';

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      {/* ── the player ── */}
      <div className="min-w-0">
        {current.kind === 'video' ? (
          <video
            ref={mediaRef}
            key={current.id}
            src={current.url}
            poster={current.coverUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            onPlay={onPlay}
            onEnded={onEnded}
            className="w-full aspect-video rounded-2xl bg-black object-contain"
          />
        ) : (
          <AudioStage
            ref={mediaRef}
            key={current.id}
            src={current.url}
            coverUrl={current.coverUrl}
            title={title}
            label={catName}
            waveform={current.waveform}
            durationSec={current.durationSec}
            isEn={isEn}
            onPlay={onPlay}
            onEnded={onEnded}
          />
        )}

        {/* An audio item already carries its title large on the cover. */}
        {current.kind === 'video' && (
          <h2 className="mt-4 text-xl sm:text-2xl font-black text-[#1a1a2e] leading-snug" style={{ textWrap: 'balance' } as React.CSSProperties}>{title}</h2>
        )}
        <p className={`${current.kind === 'video' ? 'mt-1' : 'mt-3'} text-sm text-gray-500`}>
          {catName && <span>{catName}</span>}
          {formatDuration(current.durationSec) && <><span aria-hidden> · </span><span dir="ltr" className="tabular-nums">{formatDuration(current.durationSec)}</span></>}
          {current.viewCount > 0 && <><span aria-hidden> · </span><span>{current.viewCount.toLocaleString(isEn ? 'en' : 'ar-EG')} {t('مشاهدة', 'views')}</span></>}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => download(current.id)} className={`${pill} bg-[#1a1a2e] text-[#F5C518] hover:bg-[#25254a]`}>
            <Icon name="download" size={18} /> {t('تحميل', 'Download')}
            {!user && <span className="text-[11px] font-semibold text-white/60">{t('(بحساب مجاني)', '(free account)')}</span>}
          </button>
          <button onClick={() => setShareOpen(true)} className={`${pill} bg-[#EFEBE2] text-[#1a1a2e] hover:bg-[#E5DFD2]`}>
            <Icon name="share" size={18} /> {t('مشاركة', 'Share')}
          </button>
          <Link href={`/media/${current.id}`} className={`${pill} bg-[#EFEBE2] text-[#1a1a2e] hover:bg-[#E5DFD2]`}>
            <Icon name="comment" size={18} /> {t('التعليقات والتفاعل', 'Comments & reactions')}
          </Link>
          <label className="w-full sm:w-auto sm:ms-auto mt-1 sm:mt-0 flex items-center gap-2.5 cursor-pointer select-none text-sm font-semibold text-[#1a1a2e]">
            <button
              type="button"
              role="switch"
              aria-checked={autoplay}
              onClick={toggleAutoplay}
              className={`relative w-10 h-6 rounded-full transition ${autoplay ? 'bg-[#1a1a2e]' : 'bg-gray-300'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518]`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${autoplay ? 'start-[18px] bg-[#F5C518]' : 'start-0.5'}`} />
            </button>
            {t('تشغيل تلقائي للتالي', 'Autoplay next')}
          </label>
        </div>
      </div>

      {/* ── the playlist ── */}
      <aside className="min-w-0 rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-black text-[#1a1a2e] flex items-center gap-2"><Icon name="list" size={18} /> {t('قائمة التشغيل', 'Playlist')}</h2>
          <span className="text-xs font-bold text-gray-400 tabular-nums">{at + 1} / {items.length}</span>
        </div>
        <ul ref={listRef} className="relative max-h-[420px] lg:max-h-[560px] overflow-y-auto p-2 flex flex-col gap-1">
          {items.map((it, i) => {
            const on = it.id === current.id;
            const itTitle = isEn && it.titleEn ? it.titleEn : it.title;
            return (
              <li key={it.id} data-id={it.id}>
                <button
                  type="button"
                  onClick={() => pick(it.id)}
                  aria-current={on ? 'true' : undefined}
                  className={`w-full text-start flex items-center gap-3 rounded-xl p-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${on ? 'bg-[#1a1a2e] text-white' : 'hover:bg-[#FAF8F3] text-[#1a1a2e]'}`}
                >
                  <span className={`w-6 shrink-0 text-center text-xs font-bold tabular-nums ${on ? 'text-[#F5C518]' : 'text-gray-400'}`}>
                    {on ? <Icon name="play" size={14} className="mx-auto" /> : i + 1}
                  </span>
                  <MediaThumb
                    kind={it.kind}
                    coverUrl={it.coverUrl ?? null}
                    title={itTitle}
                    className={`shrink-0 ${it.kind === 'video' ? 'w-28 aspect-video' : 'w-14 aspect-square'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-snug line-clamp-2">{itTitle}</span>
                    {formatDuration(it.durationSec) && (
                      <span dir="ltr" className={`block text-xs tabular-nums mt-0.5 ${on ? 'text-white/60' : 'text-gray-400'}`}>{formatDuration(it.durationSec)}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <MediaShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : 'https://moslimleader.com'}/media/${current.id}`}
        title={title}
        coverUrl={current.coverUrl ?? null}
        kind={current.kind}
        isEn={isEn}
      />
    </div>
  );
}
