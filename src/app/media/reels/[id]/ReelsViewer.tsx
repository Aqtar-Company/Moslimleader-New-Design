'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/Toast';
import type { PublicMediaItem } from '@/lib/free-media-query';
import Icon from '@/components/media/Icon';
import MediaReactions, { type Summary } from '@/components/media/MediaReactions';
import MediaComments from '@/components/media/MediaComments';
import { useMediaDownload } from '@/components/media/useMediaDownload';

/**
 * Reels: full screen, one vertical video per screen, swipe up for the next.
 *
 * - Scroll snapping does the swiping; an IntersectionObserver decides which reel is ON
 *   screen, and only that one plays. The rest pause, and only the neighbours preload —
 *   a list of twenty reels must not open twenty downloads.
 * - Reels start MUTED: browsers refuse sound without a tap. One tap on the sound button
 *   unmutes every reel after it for the rest of the visit.
 * - The address bar follows the reel on screen (`replaceState`), so «مشاركة» and a reload
 *   both point at what the reader is actually watching.
 * - Side column: reactions (طريق's five), comments (a sheet over the video), share, download.
 */
type Social = { reactions: Summary; comments: number };
const MUTE_KEY = 'ml-reels-muted';

export default function ReelsViewer({ reels, startIndex, social }: {
  reels: PublicMediaItem[];
  startIndex: number;
  social: Record<number, Social>;
}) {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const t = (ar: string, en: string) => (isEn ? en : ar);
  const router = useRouter();
  const { addToast } = useToast();
  const download = useMediaDownload();

  const [active, setActive] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [commentsFor, setCommentsFor] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<number, number>>(() => Object.fromEntries(Object.entries(social).map(([k, v]) => [Number(k), v.comments])));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const viewed = useRef(new Set<number>());

  // Sound preference for this visit; the page, and the body behind it, must not scroll.
  useEffect(() => {
    try { if (sessionStorage.getItem(MUTE_KEY) === '0') setMuted(false); } catch { /* ignore */ }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Open AT the reel that was asked for.
  useEffect(() => {
    const el = scrollerRef.current?.children[startIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'start' });
  }, [startIndex]);

  // Which reel is on screen.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.index));
      }
    }, { root, threshold: [0.6] });
    Array.from(root.children).forEach(c => io.observe(c));
    return () => io.disconnect();
  }, [reels.length]);

  // Play the one on screen, pause the rest; follow it in the address bar; count the view.
  useEffect(() => {
    setPaused(false);
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) { v.muted = muted; void v.play().catch(() => setPaused(true)); }
      else { v.pause(); }
    });
    const r = reels[active];
    if (!r) return;
    try { window.history.replaceState(window.history.state, '', `/media/reels/${r.id}`); } catch { /* ignore */ }
    if (!viewed.current.has(r.id)) {
      viewed.current.add(r.id);
      void fetch(`/api/media/${r.id}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoRefs.current[active];
    if (v) v.muted = muted;
    try { sessionStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  }, [muted, active]);

  const togglePlay = (i: number) => {
    const v = videoRefs.current[i];
    if (!v) return;
    if (v.paused) { void v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };

  const go = useCallback((delta: number) => {
    const el = scrollerRef.current?.children[active + delta] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [active]);

  // Keyboard: arrows move, space plays/pauses, Escape leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (commentsFor !== null) { if (e.key === 'Escape') setCommentsFor(null); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(active); }
      else if (e.key === 'Escape') router.push('/media?kind=reel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bound each render: it reads the current reel

  const share = async (r: PublicMediaItem) => {
    const url = `${window.location.origin}/media/reels/${r.id}`;
    try { if (navigator.share) { await navigator.share({ title: r.title, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); addToast(t('تم نسخ الرابط', 'Link copied'), 'success'); }
    catch { window.prompt(t('انسخ الرابط:', 'Copy the link:'), url); }
  };

  const leave = () => {
    const sameSite = document.referrer.startsWith(window.location.origin);
    if (sameSite && window.history.length > 1) router.back();
    else router.push('/media?kind=reel');
  };

  const sideBtn = 'w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]';

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white" dir={isEn ? 'ltr' : 'rtl'}>
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button type="button" onClick={leave} aria-label={t('رجوع', 'Back')} className={`${sideBtn} w-10 h-10`}><Icon name="back" size={20} /></button>
          <button type="button" onClick={() => router.push('/')} aria-label={t('الرئيسية', 'Home')} className={`${sideBtn} w-10 h-10`}><Icon name="home" size={18} /></button>
          <span className="font-black text-lg ms-1">{t('ريلز', 'Reels')}</span>
        </div>
        <button
          type="button"
          onClick={() => setMuted(m => !m)}
          aria-label={muted ? t('تشغيل الصوت', 'Unmute') : t('كتم الصوت', 'Mute')}
          className={`${sideBtn} w-10 h-10 pointer-events-auto`}
        >
          <Icon name={muted ? 'mute' : 'volume'} size={20} />
        </button>
      </div>

      {/* The reels */}
      <div ref={scrollerRef} className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory" style={{ scrollbarWidth: 'none' }}>
        {reels.map((r, i) => {
          const near = Math.abs(i - active) <= 1;
          const catName = r.category ? (isEn && r.category.nameEn ? r.category.nameEn : r.category.name) : null;
          const title = isEn && r.titleEn ? r.titleEn : r.title;
          const desc = isEn && r.descriptionEn ? r.descriptionEn : r.description;
          return (
            <section key={r.id} data-index={i} className="relative h-[100dvh] snap-start snap-always flex items-center justify-center">
              <div className="relative h-full w-full sm:w-auto sm:aspect-[9/16] max-w-full bg-black">
                <video
                  ref={el => { videoRefs.current[i] = el; }}
                  src={near ? r.url : undefined}
                  poster={r.coverUrl ?? undefined}
                  playsInline
                  loop
                  muted={muted}
                  preload={i === active ? 'auto' : near ? 'metadata' : 'none'}
                  onClick={() => togglePlay(i)}
                  className="absolute inset-0 w-full h-full object-cover sm:object-contain"
                />
                {paused && i === active && (
                  <button type="button" onClick={() => togglePlay(i)} aria-label={t('تشغيل', 'Play')}
                    className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-black/45 flex items-center justify-center">
                    <Icon name="play" size={40} />
                  </button>
                )}

                {/* Caption, bottom */}
                <div className="absolute bottom-0 inset-x-0 p-4 pe-20 pb-8 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none">
                  {catName && <p className="text-xs font-bold text-[#F5C518] mb-1">{catName}</p>}
                  <h2 className="text-base font-black leading-snug drop-shadow" style={{ overflowWrap: 'anywhere' }}>{title}</h2>
                  {desc && <p className="text-sm text-white/80 mt-1 line-clamp-2" style={{ overflowWrap: 'anywhere' }}>{desc}</p>}
                </div>

                {/* Actions, end side */}
                <div className="absolute bottom-8 end-3 z-10 flex flex-col items-center gap-4">
                  <MediaReactions mediaId={r.id} initial={social[r.id]?.reactions ?? { counts: {}, total: 0, mine: null }} isEn={isEn} layout="stack" tone="dark" />
                  <div className="flex flex-col items-center gap-1">
                    <button type="button" onClick={() => setCommentsFor(r.id)} aria-label={t('التعليقات', 'Comments')} className={sideBtn}><Icon name="comment" size={24} /></button>
                    <span className="text-xs font-bold tabular-nums drop-shadow">{counts[r.id] || ''}</span>
                  </div>
                  <button type="button" onClick={() => void share(r)} aria-label={t('مشاركة', 'Share')} className={sideBtn}><Icon name="share" size={22} /></button>
                  <button type="button" onClick={() => download(r.id)} aria-label={t('تحميل', 'Download')} className={sideBtn}><Icon name="download" size={22} /></button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Desktop: up / down */}
      <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 end-6 z-20 flex-col gap-3">
        <button type="button" onClick={() => go(-1)} disabled={active === 0} aria-label={t('السابق', 'Previous')} className={`${sideBtn} disabled:opacity-30`}><Icon name="up" size={22} /></button>
        <button type="button" onClick={() => go(1)} disabled={active === reels.length - 1} aria-label={t('التالي', 'Next')} className={`${sideBtn} disabled:opacity-30`}><Icon name="down" size={22} /></button>
      </div>

      {/* Comments sheet */}
      {commentsFor !== null && (
        <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setCommentsFor(null)}>
          <div
            role="dialog"
            aria-label={t('التعليقات', 'Comments')}
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-md h-[72dvh] bg-white text-[#1a1a2e] rounded-t-3xl sm:rounded-3xl p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black flex items-center gap-2"><Icon name="comment" size={20} /> {t('التعليقات', 'Comments')} <span className="text-gray-400 font-bold text-sm">{counts[commentsFor] || ''}</span></h3>
              <button type="button" onClick={() => setCommentsFor(null)} aria-label={t('إغلاق', 'Close')} className="p-2 rounded-full hover:bg-gray-100"><Icon name="close" size={20} /></button>
            </div>
            <div className="flex-1 min-h-0">
              <MediaComments
                mediaId={commentsFor}
                isEn={isEn}
                autoFocus
                onCount={d => setCounts(c => ({ ...c, [commentsFor]: Math.max(0, (c[commentsFor] ?? 0) + d) }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
