'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDuration } from '@/lib/free-media-shared';
import type { PublicMediaItem } from '@/lib/free-media-query';
import MediaThumb from '@/components/media/MediaThumb';
import Icon from '@/components/media/Icon';
import AudioStage from '@/components/media/AudioStage';
import MediaShareSheet from '@/components/media/MediaShareSheet';
import { useMediaDownload } from '@/components/media/useMediaDownload';
import MediaEngage from '@/components/media/MediaEngage';
import MediaQuickBar from '@/components/media/MediaQuickBar';
import MediaQuickComment from '@/components/media/MediaQuickComment';

/**
 * The audio and video tabs of /media open straight on a player: the first item of the
 * chosen category, with the rest of the category as a playlist beside it (below it on a
 * phone). Picking an item plays it here, without leaving the page; when one ends the next
 * starts, as a playlist does. The grid of cells is one tap away (the toggle in
 * MediaBrowser). Reactions and comments for the item playing sit under the player
 * (MediaEngage); its own page adds the sleep timer.
 *
 * «تشغيل تلقائي» shares its stored switch with the item page (`ml-media-autoplay`).
 *
 * «ترتيب» lets the listener arrange the list: drag a row by its handle, or move it with the
 * up/down buttons (the keyboard and screen-reader path), «بعد الحالي» to queue it next,
 * «عشوائي» to shuffle and «الترتيب الأصلي» to undo. The order itself is kept by MediaBrowser
 * (per kind + category + language, in this browser); «التالي» follows it.
 */
const AUTOPLAY_KEY = 'ml-media-autoplay';

export default function MediaPlaylist({ items, current, onPick, isEn, customOrder = false, onReorder, onResetOrder }: {
  items: PublicMediaItem[];
  current: PublicMediaItem;
  onPick: (id: number) => void;
  isEn: boolean;
  /** The list is in the listener's own order (shows «الترتيب الأصلي»). */
  customOrder?: boolean;
  /** Absent while a search filters the list — a filtered list is not reordered. */
  onReorder?: (ids: number[]) => void;
  onResetOrder?: () => void;
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
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  useEffect(() => { if (!onReorder) setEditing(false); }, [onReorder]);

  const ids = items.map(i => i.id);
  const commit = (next: number[]) => { if (onReorder && next.join() !== ids.join()) onReorder(next); };
  const move = (id: number, to: number) => {
    const rest = ids.filter(x => x !== id);
    const at2 = Math.max(0, Math.min(rest.length, to));
    commit([...rest.slice(0, at2), id, ...rest.slice(at2)]);
  };
  const playAfterCurrent = (id: number) => {
    const rest = ids.filter(x => x !== id);
    commit([...rest.slice(0, rest.indexOf(current.id) + 1), id, ...rest.slice(rest.indexOf(current.id) + 1)]);
  };
  const shuffle = () => {
    // The item playing stays on top, so «التالي» continues into the shuffled order.
    const rest = ids.filter(x => x !== current.id);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    commit([current.id, ...rest]);
  };

  // Drag by the handle — pointer events, so a finger works as well as a mouse. Moves are
  // read on WINDOW: React moves the row's DOM node as the order changes, and a moved node
  // loses its pointer capture. The row's new place is the count of OTHER rows whose middle
  // is above the pointer.
  const dragRef = useRef<number | null>(null);
  const moveRef = useRef(move);
  moveRef.current = move;
  const startDrag = (e: React.PointerEvent, id: number) => {
    e.preventDefault();
    dragRef.current = id;
    setDragId(id);
    const onMove = (ev: PointerEvent) => {
      const dragging = dragRef.current;
      const list = listRef.current;
      if (dragging === null || !list) return;
      ev.preventDefault();
      const box = list.getBoundingClientRect();
      if (ev.clientY < box.top + 36) list.scrollBy(0, -12);
      else if (ev.clientY > box.bottom - 36) list.scrollBy(0, 12);
      let k = 0;
      list.querySelectorAll<HTMLElement>('li[data-id]').forEach(li => {
        if (Number(li.dataset.id) === dragging) return;
        const r = li.getBoundingClientRect();
        if (r.top + r.height / 2 < ev.clientY) k++;
      });
      moveRef.current(dragging, k);
    };
    const onUp = () => {
      dragRef.current = null;
      setDragId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

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
    <div id="media-player" className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start scroll-mt-24">
      {/* ── the player ── */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        {current.kind === 'video' ? (
          <div className="rounded-2xl overflow-hidden bg-black">
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
            className="w-full aspect-video bg-black object-contain block"
          />
          <div className="px-3 py-2 bg-[#0f1424] border-t border-white/10">
            <MediaQuickBar key={current.id} mediaId={current.id} isEn={isEn} />
          </div>
          </div>
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
            footer={<MediaQuickBar key={current.id} mediaId={current.id} isEn={isEn} writer={false} />}
            below={<MediaQuickComment key={current.id} mediaId={current.id} isEn={isEn} />}
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
      <aside className="min-w-0 rounded-2xl bg-white border border-gray-100 overflow-hidden lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-black text-[#1a1a2e] flex items-center gap-2"><Icon name="list" size={18} /> {t('قائمة التشغيل', 'Playlist')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 tabular-nums">{at + 1} / {items.length}</span>
            {onReorder && items.length > 1 && (
              <button
                type="button"
                onClick={() => setEditing(v => !v)}
                aria-pressed={editing}
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${editing ? 'bg-[#F5C518] text-[#1a1a2e]' : 'bg-[#EFEBE2] text-[#1a1a2e] hover:bg-[#E5DFD2]'}`}
              >
                {editing ? <><Icon name="check" size={14} /> {t('تم', 'Done')}</> : <><Icon name="sort" size={14} /> {t('ترتيب', 'Arrange')}</>}
              </button>
            )}
          </div>
        </div>
        {editing && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-[#FAF8F3]">
            <p className="w-full text-[11px] text-gray-500">{t('اسحب من المقبض أو استخدم الأسهم. الترتيب محفوظ على هذا الجهاز.', 'Drag by the handle or use the arrows. Your order is saved on this device.')}</p>
            <button type="button" onClick={shuffle} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-bold bg-white border border-gray-200 text-[#1a1a2e] hover:bg-[#EFEBE2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
              <Icon name="shuffle" size={14} /> {t('عشوائي', 'Shuffle')}
            </button>
            {customOrder && onResetOrder && (
              <button type="button" onClick={onResetOrder} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-bold bg-white border border-gray-200 text-[#1a1a2e] hover:bg-[#EFEBE2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
                <Icon name="undo" size={14} className="icon-dir-flip" /> {t('الترتيب الأصلي', 'Original order')}
              </button>
            )}
          </div>
        )}
        <ul ref={listRef} className="relative max-h-[420px] lg:max-h-[560px] overflow-y-auto p-2 flex flex-col gap-1">
          {items.map((it, i) => {
            const on = it.id === current.id;
            const itTitle = isEn && it.titleEn ? it.titleEn : it.title;
            return (
              <li key={it.id} data-id={it.id} className={`flex items-center gap-1 rounded-xl transition ${dragId === it.id ? 'bg-[#F5C518]/25 shadow-md' : ''}`}>
                {editing && (
                  <span
                    role="presentation"
                    onPointerDown={e => startDrag(e, it.id)}
                    className="shrink-0 w-7 h-12 flex items-center justify-center text-gray-400 cursor-grab active:cursor-grabbing touch-none select-none"
                    title={t('اسحب لتغيير المكان', 'Drag to move')}
                  >
                    <Icon name="grip" size={18} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => pick(it.id)}
                  aria-current={on ? 'true' : undefined}
                  className={`min-w-0 flex-1 text-start flex items-center gap-3 rounded-xl p-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${on ? 'bg-[#1a1a2e] text-white' : 'hover:bg-[#FAF8F3] text-[#1a1a2e]'}`}
                >
                  <span className={`w-6 shrink-0 text-center text-xs font-bold tabular-nums ${on ? 'text-[#F5C518]' : 'text-gray-400'}`}>
                    {on ? <Icon name="play" size={14} className="mx-auto" /> : i + 1}
                  </span>
                  <MediaThumb
                    kind={it.kind}
                    coverUrl={it.coverUrl ?? null}
                    title={itTitle}
                    className={`shrink-0 ${it.kind === 'video' ? (editing ? 'w-20 aspect-video' : 'w-28 aspect-video') : (editing ? 'w-11 aspect-square' : 'w-14 aspect-square')}`}
                    width={320}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-snug line-clamp-2">{itTitle}</span>
                    {formatDuration(it.durationSec) && (
                      <span dir="ltr" className={`block text-xs tabular-nums mt-0.5 ${on ? 'text-white/60' : 'text-gray-400'}`}>{formatDuration(it.durationSec)}</span>
                    )}
                  </span>
                </button>
                {editing && (
                  <span className="shrink-0 flex flex-col items-center">
                    <button type="button" onClick={() => move(it.id, i - 1)} disabled={i === 0} aria-label={t(`تحريك «${itTitle}» لأعلى`, `Move "${itTitle}" up`)} className="w-8 h-7 flex items-center justify-center rounded-md text-[#1a1a2e] hover:bg-[#EFEBE2] disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
                      <Icon name="up" size={16} />
                    </button>
                    <button type="button" onClick={() => move(it.id, i + 1)} disabled={i === items.length - 1} aria-label={t(`تحريك «${itTitle}» لأسفل`, `Move "${itTitle}" down`)} className="w-8 h-7 flex items-center justify-center rounded-md text-[#1a1a2e] hover:bg-[#EFEBE2] disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
                      <Icon name="down" size={16} />
                    </button>
                  </span>
                )}
                {editing && !on && (
                  <button type="button" onClick={() => playAfterCurrent(it.id)} title={t('تشغيل بعد الحالي', 'Play next')} aria-label={t(`تشغيل «${itTitle}» بعد الحالي`, `Play "${itTitle}" next`)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-[#1a1a2e] hover:bg-[#EFEBE2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
                    <Icon name="next" size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Reactions and comments for what is playing — under the player on a computer, after
          the playlist on a phone (the list stays right under the song). */}
      <div className="min-w-0 lg:col-start-1">
        <MediaEngage key={current.id} mediaId={current.id} isEn={isEn} />
      </div>

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
