'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { KIND_LABEL, formatDuration } from '@/lib/free-media-shared';
import type { PublicMediaItem } from '@/lib/free-media-query';
import MediaThumb from '@/components/media/MediaThumb';
import Icon from '@/components/media/Icon';
import MediaNavBar from '@/components/media/MediaNavBar';
import AudioStage from '@/components/media/AudioStage';
import { useMediaDownload } from '@/components/media/useMediaDownload';
import MediaReactions, { type Summary } from '@/components/media/MediaReactions';
import MediaComments from '@/components/media/MediaComments';

/**
 * One media item: the player, what it is, share and download, and what plays next.
 *
 * Two listening aids, both remembered:
 *  - «تشغيل تلقائي» — when an item ends, the next one in its category starts after a short
 *    countdown (cancellable). Per device, in localStorage; on by default.
 *  - «مؤقّت النوم» — stop after 15/30/60 minutes or at the end of the current item, with
 *    the volume fading out instead of cutting. It is for قصص قبل النوم: the shelf plays on
 *    by itself and still stops when the child is asleep. Kept in sessionStorage so it
 *    survives the move from one story to the next, and dies with the tab.
 */

const AUTOPLAY_KEY = 'ml-media-autoplay';
const SLEEP_KEY = 'ml-media-sleep';
const COUNTDOWN_S = 6;

type Sleep = { until: number | null; endOfTrack: boolean } | null;

function readSleep(): Sleep {
  try {
    const raw = sessionStorage.getItem(SLEEP_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Sleep;
    if (s && s.until && s.until < Date.now()) return null;
    return s;
  } catch { return null; }
}
function writeSleep(s: Sleep) {
  try { if (s) sessionStorage.setItem(SLEEP_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SLEEP_KEY); } catch { /* private mode */ }
}

export default function MediaWatch({ item, upNext, reactions, commentCount }: {
  item: PublicMediaItem;
  upNext: PublicMediaItem[];
  reactions: Summary;
  commentCount: number;
}) {
  const [comments, setComments] = useState(commentCount);
  const { lang } = useLang();
  const isEn = lang === 'en';
  const t = (ar: string, en: string) => (isEn ? en : ar);
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const playable = item.kind === 'video' || item.kind === 'audio';
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const next = upNext[0] ?? null;

  const [autoplay, setAutoplay] = useState(true);
  const [sleep, setSleep] = useState<Sleep>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const title = isEn && item.titleEn ? item.titleEn : item.title;
  const description = isEn && item.descriptionEn ? item.descriptionEn : item.description;
  const catName = item.category ? (isEn && item.category.nameEn ? item.category.nameEn : item.category.name) : null;

  // ── restore preferences, count the view, honour ?autoplay=1 from the previous item ─────
  useEffect(() => {
    try { const v = localStorage.getItem(AUTOPLAY_KEY); if (v !== null) setAutoplay(v === '1'); } catch { /* ignore */ }
    setSleep(readSleep());
    void fetch(`/api/media/${item.id}/view`, { method: 'POST' }).catch(() => {});
  }, [item.id]);

  useEffect(() => {
    if (params.get('autoplay') !== '1' || !mediaRef.current) return;
    // The reader started the previous item themselves on this same page session, so the
    // browser normally allows this. If it refuses, the controls are right there.
    void mediaRef.current.play().catch(() => {});
  }, [params, item.id]);

  const toggleAutoplay = () => {
    setAutoplay(v => {
      try { localStorage.setItem(AUTOPLAY_KEY, v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  };

  const goNext = useCallback(() => {
    if (!next) return;
    setCountdown(null);
    router.push(`/media/${next.id}?autoplay=1`);
  }, [next, router]);

  // ── the countdown to the next item ────────────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { goNext(); return; }
    const id = setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown, goNext]);

  // ── the sleep timer ──────────────────────────────────────────────────────────────
  const fadeOutAndStop = useCallback(() => {
    const m = mediaRef.current;
    setCountdown(null);
    writeSleep(null);
    setSleep(null);
    if (!m || m.paused) return;
    const start = m.volume;
    let step = 0;
    const id = setInterval(() => {
      step++;
      m.volume = Math.max(0, start * (1 - step / 20));
      if (step >= 20) { clearInterval(id); m.pause(); m.volume = start; }
    }, 250);
    addToast(t('انتهى مؤقّت النوم — تصبحون على خير', 'Sleep timer finished — good night'), 'info', 5000);
  }, [addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sleep?.until) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (sleep.until && Date.now() >= sleep.until) fadeOutAndStop();
    }, 1000);
    return () => clearInterval(id);
  }, [sleep, fadeOutAndStop]);

  const chooseSleep = (v: string) => {
    const s: Sleep = v === 'off' ? null : v === 'end' ? { until: null, endOfTrack: true } : { until: Date.now() + Number(v) * 60_000, endOfTrack: false };
    writeSleep(s);
    setSleep(s);
    setNow(Date.now());
  };

  const onEnded = () => {
    if (sleep?.endOfTrack) { fadeOutAndStop(); return; }
    if (autoplay && next) setCountdown(COUNTDOWN_S);
  };

  // ── lock-screen controls for audio (and video in the background) ──────────────────
  useEffect(() => {
    if (!playable || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'مسلم ليدر',
        album: catName ?? KIND_LABEL[item.kind].ar,
        ...(item.coverUrl ? { artwork: [{ src: item.coverUrl }] } : {}),
      });
      navigator.mediaSession.setActionHandler('nexttrack', next ? () => goNext() : null);
    } catch { /* older browsers */ }
  }, [playable, title, catName, item.kind, item.coverUrl, next, goNext]);

  // ── share & download ─────────────────────────────────────────────────────────────
  const share = async () => {
    const url = `${window.location.origin}/media/${item.id}`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
    } catch { return; /* the reader closed the share sheet */ }
    try {
      await navigator.clipboard.writeText(url);
      addToast(t('تم نسخ الرابط', 'Link copied'), 'success');
    } catch {
      window.prompt(t('انسخ الرابط:', 'Copy the link:'), url);
    }
  };

  const downloadById = useMediaDownload();
  const download = () => downloadById(item.id);

  const sleepLeft = sleep?.until ? Math.max(0, Math.ceil((sleep.until - now) / 60_000)) : null;
  const sleepValue = !sleep ? 'off' : sleep.endOfTrack ? 'end' : 'custom';

  return (
    <div className="min-h-screen bg-[#FAF8F3]" dir={isEn ? 'ltr' : 'rtl'}>
      {/* Behind the fixed, transparent site header — its icons are white. */}
      <div className="bg-[#1a1a2e] h-24" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-16">
        <div className="mb-3 flex items-center gap-x-4 gap-y-2 flex-wrap">
        <MediaNavBar fallback={`/media?kind=${item.kind}`} tone="light" />
        <nav className="text-sm text-gray-500 flex items-center gap-1.5 flex-wrap" aria-label={t('مسار الصفحة', 'Breadcrumb')}>
          <Link href="/media" className="hover:text-[#1a1a2e] font-semibold">{t('الوسائط', 'Media')}</Link>
          <span aria-hidden>/</span>
          <Link href={`/media?kind=${item.kind}`} className="hover:text-[#1a1a2e]">{isEn ? KIND_LABEL[item.kind].en : KIND_LABEL[item.kind].ar}</Link>
          {item.category && (<><span aria-hidden>/</span><Link href={`/media?kind=${item.kind}&cat=${item.category.id}`} className="hover:text-[#1a1a2e]">{catName}</Link></>)}
        </nav>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          {/* ── main column ── */}
          <div className="min-w-0">
            <div className="relative">
              {item.kind === 'video' && (
                <video
                  ref={mediaRef}
                  key={item.id}
                  src={item.url}
                  poster={item.coverUrl ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  onEnded={onEnded}
                  onPlay={() => setCountdown(null)}
                  className="w-full aspect-video rounded-2xl bg-black object-contain"
                />
              )}
              {item.kind === 'audio' && (
                <AudioStage
                  ref={mediaRef}
                  key={item.id}
                  src={item.url}
                  coverUrl={item.coverUrl}
                  title={title}
                  label={catName}
                  waveform={item.waveform}
                  durationSec={item.durationSec}
                  isEn={isEn}
                  onEnded={onEnded}
                  onPlay={() => setCountdown(null)}
                />
              )}
              {item.kind === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl ?? item.url} alt={title} decoding="async" className="w-full max-h-[80vh] object-contain rounded-2xl bg-white border border-gray-100" />
              )}
              {item.kind === 'pdf' && (
                <div className="rounded-2xl bg-white border border-gray-100 p-6 flex flex-col items-center text-center gap-4">
                  <MediaThumb kind="pdf" coverUrl={item.coverUrl} title={title} className="w-48 aspect-[3/4]" />
                  <p className="text-sm text-gray-500">{t('ملف PDF — اضغط «تحميل» لحفظه وفتحه.', 'A PDF file — press Download to save and open it.')}</p>
                </div>
              )}

              {/* Up-next countdown, over the player */}
              {countdown !== null && next && (
                <div className="absolute inset-0 rounded-2xl bg-black/75 flex flex-col items-center justify-center text-center p-4 gap-3" role="status">
                  <p className="text-white/70 text-sm">{t('التالي خلال', 'Up next in')} <span className="font-black text-white tabular-nums">{countdown}</span></p>
                  <p className="text-white font-bold text-lg max-w-md line-clamp-2">{isEn && next.titleEn ? next.titleEn : next.title}</p>
                  <div className="flex gap-2">
                    <button onClick={goNext} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F5C518] text-[#1a1a2e] font-bold text-sm"><Icon name="next" size={16} />{t('شغّل الآن', 'Play now')}</button>
                    <button onClick={() => setCountdown(null)} className="px-4 py-2 rounded-full bg-white/15 text-white font-bold text-sm">{t('إلغاء', 'Cancel')}</button>
                  </div>
                </div>
              )}
            </div>

            <h1 className="mt-4 text-xl sm:text-2xl font-black text-[#1a1a2e] leading-snug" style={{ textWrap: 'balance' } as React.CSSProperties}>{title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {catName && <span>{catName}</span>}
              {formatDuration(item.durationSec) && <><span aria-hidden> · </span><span dir="ltr" className="tabular-nums">{formatDuration(item.durationSec)}</span></>}
              {item.viewCount > 0 && <><span aria-hidden> · </span><span>{item.viewCount.toLocaleString(isEn ? 'en' : 'ar-EG')} {t('مشاهدة', 'views')}</span></>}
            </p>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <MediaReactions mediaId={item.id} initial={reactions} isEn={isEn} />
              <button onClick={download} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1a1a2e] text-[#F5C518] font-bold text-sm hover:bg-[#25254a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518]">
                <Icon name="download" size={18} /> {t('تحميل', 'Download')}
                {!user && <span className="text-[11px] font-semibold text-white/60">{t('(بحساب مجاني)', '(free account)')}</span>}
              </button>
              <button onClick={share} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#EFEBE2] text-[#1a1a2e] font-bold text-sm hover:bg-[#E5DFD2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518]">
                <Icon name="share" size={18} /> {t('مشاركة', 'Share')}
              </button>
            </div>

            {/* Listening aids — only where something plays */}
            {playable && (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-white border border-gray-100 px-4 py-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm font-semibold text-[#1a1a2e]">
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
                <label className="flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                  <Icon name="moon" size={18} /> {t('مؤقّت النوم', 'Sleep timer')}
                  <select
                    value={sleepValue}
                    onChange={e => chooseSleep(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-[#FAF8F3] px-2 py-1 text-sm font-normal"
                  >
                    <option value="off">{t('متوقّف', 'Off')}</option>
                    <option value="end">{t('بعد انتهاء هذا المقطع', 'End of this item')}</option>
                    <option value="15">{t('بعد 15 دقيقة', '15 minutes')}</option>
                    <option value="30">{t('بعد 30 دقيقة', '30 minutes')}</option>
                    <option value="60">{t('بعد ساعة', '1 hour')}</option>
                    {sleepValue === 'custom' && <option value="custom">{t(`يتبقّى ${sleepLeft} د`, `${sleepLeft} min left`)}</option>}
                  </select>
                </label>
              </div>
            )}

            {description && (
              <p className="mt-4 rounded-2xl bg-white border border-gray-100 p-4 text-sm leading-7 text-gray-700 whitespace-pre-line" style={{ overflowWrap: 'anywhere' }}>
                {description}
              </p>
            )}

            {/* Comments — open to read, an account to write. */}
            <section className="mt-6 rounded-2xl bg-white border border-gray-100 p-4" aria-labelledby="media-comments-title">
              <h2 id="media-comments-title" className="font-black text-[#1a1a2e] mb-3 flex items-center gap-2">
                <Icon name="comment" size={20} /> {t('التعليقات', 'Comments')}
                {comments > 0 && <span className="text-sm text-gray-400 font-bold tabular-nums">{comments}</span>}
              </h2>
              <MediaComments mediaId={item.id} isEn={isEn} onCount={d => setComments(c => Math.max(0, c + d))} />
            </section>
          </div>

          {/* ── up next ── */}
          {upNext.length > 0 && (
            <aside className="min-w-0">
              <h2 className="text-sm font-black text-[#1a1a2e] mb-3">{t('التالي', 'Up next')}</h2>
              <ul className="flex flex-col gap-3">
                {upNext.map((u, i) => (
                  <li key={u.id}>
                    <Link href={`/media/${u.id}`} className="group flex gap-3 rounded-xl p-1 -m-1 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]">
                      <MediaThumb
                        kind={u.kind}
                        coverUrl={u.coverUrl ?? u.previewUrl ?? null}
                        title={u.title}
                        durationSec={u.durationSec}
                        className={`w-40 shrink-0 ${u.kind === 'image' || u.kind === 'pdf' ? 'aspect-[4/3]' : 'aspect-video'}`}
                      />
                      <div className="min-w-0 py-0.5">
                        {i === 0 && autoplay && playable && <p className="text-[10px] font-bold text-amber-700 mb-0.5">{t('يُشغَّل تلقائياً', 'Plays next')}</p>}
                        <p className="text-sm font-bold text-[#1a1a2e] leading-snug line-clamp-2">{isEn && u.titleEn ? u.titleEn : u.title}</p>
                        {u.category && <p className="text-xs text-gray-500 mt-0.5">{isEn && u.category.nameEn ? u.category.nameEn : u.category.name}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
