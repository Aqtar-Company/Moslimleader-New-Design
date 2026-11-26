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
 * The listener arranges the list BY HAND: drag any row (mouse), or press-and-hold then drag
 * (finger); Alt+↑/↓ on a focused row for the keyboard. «عشوائي» shuffles and «الترتيب
 * الأصلي» undoes. The order itself is kept by MediaBrowser
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
  const [dragId, setDragId] = useState<number | null>(null);

  const ids = items.map(i => i.id);
  const commit = (next: number[]) => { if (onReorder && next.join() !== ids.join()) onReorder(next); };
  const move = (id: number, to: number) => {
    const rest = ids.filter(x => x !== id);
    const at2 = Math.max(0, Math.min(rest.length, to));
    commit([...rest.slice(0, at2), id, ...rest.slice(at2)]);
  };
  const shuffle = () => {
    // The item playing stays on top, so «التالي» continues into the shuffled order.
    const rest = ids.filter(x => x !== current.id);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    commit([current.id, ...rest]);
  };

  // ── Drag a row by hand ──
  // Mouse: press any row and move it. Finger: press and HOLD a row, then drag — a quick
  // swipe still scrolls the list, as a finger on a list expects; the grip at the row's end
  // starts at once. Positions are read on WINDOW: React moves the row's DOM node as the
  // order changes, and a moved node would lose a capture. The row's new place is the count
  // of OTHER rows whose middle is above the pointer. A tap that ended a drag does not play.
  const dragRef = useRef<number | null>(null);
  const moveRef = useRef(move);
  moveRef.current = move;
  const noClickUntil = useRef(0);
  const beginDrag = (id: number) => {
    dragRef.current = id;
    setDragId(id);
    try { navigator.vibrate?.(15); } catch { /* not supported */ }
  };
  const endDrag = () => {
    if (dragRef.current !== null) noClickUntil.current = Date.now() + 400;
    dragRef.current = null;
    setDragId(null);
  };
  const placeAt = (y: number) => {
    const dragging = dragRef.current;
    const list = listRef.current;
    if (dragging === null || !list) return;
    const box = list.getBoundingClientRect();
    if (y < box.top + 40) list.scrollBy(0, -14);
    else if (y > box.bottom - 40) list.scrollBy(0, 14);
    let k = 0;
    list.querySelectorAll<HTMLElement>('li[data-id]').forEach(li => {
      if (Number(li.dataset.id) === dragging) return;
      const r = li.getBoundingClientRect();
      if (r.top + r.height / 2 < y) k++;
    });
    moveRef.current(dragging, k);
  };
  const onRowPointerDown = (e: React.PointerEvent, id: number) => {
    if (!onReorder || e.pointerType === 'touch' || e.button !== 0) return;
    const y0 = e.clientY;
    let started = false;
    const mv = (ev: PointerEvent) => {
      if (!started) { if (Math.abs(ev.clientY - y0) < 6) return; started = true; beginDrag(id); }
      ev.preventDefault();
      placeAt(ev.clientY);
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      endDrag();
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const onRowTouchStart = (e: React.TouchEvent, id: number, holdMs: number) => {
    if (!onReorder || e.touches.length !== 1) return;
    const x0 = e.touches[0].clientX, y0 = e.touches[0].clientY;
    let timer = window.setTimeout(() => { timer = 0; beginDrag(id); }, holdMs);
    const cleanup = () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
    function mv(ev: TouchEvent) {
      const p = ev.touches[0];
      if (dragRef.current === null) {
        // Moved before the hold completed: it is a scroll, not a drag.
        if (Math.hypot(p.clientX - x0, p.clientY - y0) > 8) cleanup();
        return;
      }
      ev.preventDefault();
      placeAt(p.clientY);
    }
    function end() { cleanup(); endDrag(); }
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
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
              <>
                <button type="button" onClick={shuffle} title={t('عشوائي', 'Shuffle')} aria-label={t('ترتيب عشوائي', 'Shuffle')} className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-[#EFEBE2] text-[#1a1a2e] hover:bg-[#E5DFD2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
                  <Icon name="shuffle" size={15} />
                </button>
                {customOrder && onResetOrder && (
                  <button type="button" onClick={onResetOrder} title={t('الترتيب الأصلي', 'Original order')} aria-label={t('الترتيب الأصلي', 'Original order')} className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-[#EFEBE2] text-[#1a1a2e] hover:bg-[#E5DFD2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
                    <Icon name="undo" size={15} className="icon-dir-flip" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {onReorder && items.length > 1 && (
          <p className="px-4 py-1.5 text-[11px] text-gray-400 border-b border-gray-100 flex items-center gap-1.5">
            <Icon name="grip" size={13} />
            {t('رتّبها بيدك: اسحب أي عنصر لمكانه — على الموبايل اضغط عليه مطوّلاً ثم اسحب.', 'Arrange by hand: drag any item into place — on a phone, press and hold it, then drag.')}
          </p>
        )}
        <ul ref={listRef} className="relative max-h-[420px] lg:max-h-[560px] overflow-y-auto p-2 flex flex-col gap-1">
          {items.map((it, i) => {
            const on = it.id === current.id;
            const itTitle = isEn && it.titleEn ? it.titleEn : it.title;
            return (
              <li
                key={it.id}
                data-id={it.id}
                onPointerDown={e => onRowPointerDown(e, it.id)}
                onTouchStart={e => onRowTouchStart(e, it.id, 350)}
                onContextMenu={onReorder ? e => e.preventDefault() : undefined}
                onDragStart={e => e.preventDefault()}
                className={`flex items-center gap-1 rounded-xl transition select-none [-webkit-touch-callout:none] ${dragId === it.id ? 'relative z-10 scale-[1.02] bg-[#F5C518]/30 shadow-lg ring-2 ring-[#F5C518] cursor-grabbing' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => { if (Date.now() < noClickUntil.current) return; pick(it.id); }}
                  onKeyDown={e => {
                    // Keyboard path: Alt + ↑/↓ moves the focused item.
                    if (!onReorder || !e.altKey) return;
                    if (e.key === 'ArrowUp') { e.preventDefault(); move(it.id, i - 1); }
                    if (e.key === 'ArrowDown') { e.preventDefault(); move(it.id, i + 1); }
                  }}
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
                    className={`shrink-0 ${it.kind === 'video' ? 'w-24 aspect-video' : 'w-14 aspect-square'}`}
                    width={320}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-snug line-clamp-2">{itTitle}</span>
                    {formatDuration(it.durationSec) && (
                      <span dir="ltr" className={`block text-xs tabular-nums mt-0.5 ${on ? 'text-white/60' : 'text-gray-400'}`}>{formatDuration(it.durationSec)}</span>
                    )}
                  </span>
                </button>
                {onReorder && items.length > 1 && (
                  <span
                    aria-hidden
                    onTouchStart={e => { e.stopPropagation(); onRowTouchStart(e, it.id, 0); }}
                    className="shrink-0 w-7 h-12 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab touch-none"
                  >
                    <Icon name="grip" size={18} />
                  </span>
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
