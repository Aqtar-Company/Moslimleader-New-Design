'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { MEDIA_KINDS, KIND_LABEL, isMediaKind, type MediaKind } from '@/lib/free-media-shared';
import type { PublicMediaCategory, PublicMediaItem } from '@/lib/free-media-query';
import MediaThumb from '@/components/media/MediaThumb';
import Icon from '@/components/media/Icon';
import MediaNavBar from '@/components/media/MediaNavBar';
import { useMediaDownload } from '@/components/media/useMediaDownload';

/**
 * /media — the library as a browsing page: kind tabs on top, the kind's categories as a
 * row of chips under them (the YouTube pattern), and a grid of thumbnails. The chosen tab
 * and chip live in the URL, so «قصص قبل النوم» is a link that can be shared as it is.
 */
export default function MediaBrowser({ items, categories }: { items: PublicMediaItem[]; categories: PublicMediaCategory[] }) {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const router = useRouter();
  const params = useSearchParams();

  const kinds = useMemo(() => MEDIA_KINDS.filter(k => items.some(i => i.kind === k)), [items]);
  const qKind = params.get('kind');
  const kind: MediaKind | null = isMediaKind(qKind) && kinds.includes(qKind) ? qKind : (kinds[0] ?? null);
  const qCat = Number(params.get('cat'));
  const kindCats = categories.filter(c => c.kind === kind);
  const cat = kindCats.some(c => c.id === qCat) ? qCat : null;
  const [query, setQuery] = useState('');
  const download = useMediaDownload();

  // Typing filters as you go; leaving the page and coming back should not keep a stale term.
  useEffect(() => { setQuery(''); }, [kind]);

  const setParam = (next: { kind?: MediaKind; cat?: number | null }) => {
    const sp = new URLSearchParams(params.toString());
    if (next.kind) { sp.set('kind', next.kind); sp.delete('cat'); }
    if (next.cat !== undefined) { if (next.cat) sp.set('cat', String(next.cat)); else sp.delete('cat'); }
    router.replace(`/media${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
  };

  const q = query.trim().toLowerCase();
  const shown = items.filter(i =>
    i.kind === kind &&
    (!cat || i.categoryId === cat) &&
    (!q || i.title.toLowerCase().includes(q) || (i.titleEn ?? '').toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)),
  );
  const portrait = kind === 'image' || kind === 'pdf' || kind === 'reel';
  const t = (ar: string, en: string) => (isEn ? en : ar);

  return (
    <div className="min-h-screen bg-[#FAF8F3]" dir={isEn ? 'ltr' : 'rtl'}>
      {/* The site header is fixed and transparent with white icons; this band sits behind
          it so they stay readable, and carries the page's title and search. */}
      <div className="bg-[#1a1a2e] pt-24 pb-7">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-4">
          <MediaNavBar fallback="/" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {t('وسائط مسلم ليدر', 'Moslim Leader Media')}
            </h1>
            <p className="text-sm text-white/65 mt-1.5 max-w-xl">
              {t('أناشيد، قصص، فيديوهات ورسومات — شاهد واستمع مجاناً، وحمّل بعد إنشاء حساب.', 'Nasheeds, stories, videos and drawings — free to watch and listen; download with a free account.')}
            </p>
          </div>
          <label className="relative sm:w-72">
            <span className="sr-only">{t('بحث', 'Search')}</span>
            <Icon name="search" size={18} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-white/50 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('ابحث في الوسائط…', 'Search media…')}
              className="w-full rounded-full border border-white/15 bg-white/10 text-white placeholder:text-white/50 ps-10 pe-4 py-2.5 text-sm outline-none focus:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#F5C518]"
            />
          </label>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-16">
        {kinds.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <span className="inline-flex text-gray-300 mb-3"><Icon name="video" size={44} strokeWidth={1.5} /></span>
            <p className="text-gray-500">{t('لا توجد وسائط منشورة بعد — قريباً بإذن الله.', 'Nothing published yet — coming soon.')}</p>
          </div>
        ) : (
          <>
            {/* Kind tabs */}
            <div role="tablist" className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 mb-4 w-fit max-w-full overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {kinds.map(k => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setParam({ kind: k })}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${kind === k ? 'bg-[#1a1a2e] text-[#F5C518]' : 'text-gray-600 hover:text-[#1a1a2e]'}`}
                >
                  <span className="inline-flex items-center gap-1.5"><Icon name={k} size={17} />{isEn ? KIND_LABEL[k].en : KIND_LABEL[k].ar}</span>
                </button>
              ))}
            </div>

            {/* Category chips */}
            {kindCats.length > 0 && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {[{ id: null as number | null, label: t('الكل', 'All') }, ...kindCats.map(c => ({ id: c.id as number | null, label: isEn && c.nameEn ? c.nameEn : c.name }))].map(chip => {
                  const active = cat === chip.id;
                  return (
                    <button
                      key={String(chip.id)}
                      onClick={() => setParam({ cat: chip.id })}
                      aria-pressed={active}
                      className={`shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518] ${active ? 'bg-[#1a1a2e] text-white' : 'bg-[#EFEBE2] text-[#1a1a2e] hover:bg-[#E5DFD2]'}`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}

            {shown.length === 0 ? (
              <p className="text-center text-gray-400 py-16">{t('لا نتائج هنا.', 'Nothing here.')}</p>
            ) : (
              <div className={`grid gap-x-4 gap-y-7 ${portrait ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                {shown.map(item => {
                  const title = isEn && item.titleEn ? item.titleEn : item.title;
                  const catName = item.category ? (isEn && item.category.nameEn ? item.category.nameEn : item.category.name) : null;
                  // A drawing or a PDF is something one SAVES; its download button sits on the
                  // card itself instead of one page away.
                  const savable = item.kind === 'image' || item.kind === 'pdf';
                  return (
                    <div key={item.id} className="flex flex-col">
                      <Link href={item.kind === 'reel' ? `/media/reels/${item.id}` : `/media/${item.id}`} className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5C518]">
                        <MediaThumb
                          kind={item.kind}
                          coverUrl={item.coverUrl ?? item.previewUrl ?? null}
                          title={title}
                          durationSec={item.durationSec}
                          className={`${kind === 'reel' ? 'aspect-[9/16]' : portrait ? 'aspect-[3/4]' : 'aspect-video'} transition group-hover:shadow-lg group-hover:-translate-y-0.5`}
                        />
                        <h2 className="mt-2.5 text-[15px] font-bold leading-snug text-[#1a1a2e] line-clamp-2">{title}</h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {catName && <span>{catName}</span>}
                          {catName && item.viewCount > 0 && <span aria-hidden> · </span>}
                          {item.viewCount > 0 && <span>{item.viewCount.toLocaleString(isEn ? 'en' : 'ar-EG')} {t('مشاهدة', 'views')}</span>}
                        </p>
                      </Link>
                      {savable && (
                        <button
                          type="button"
                          onClick={() => download(item.id)}
                          className="mt-2 self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#1a1a2e] text-[#F5C518] text-xs font-bold hover:bg-[#25254a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C518]"
                        >
                          <Icon name="download" size={15} />
                          {t('تحميل', 'Download')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
