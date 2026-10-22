'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import type { PublicMediaItem } from '@/lib/free-media-query';
import MediaThumb from './MediaThumb';

/**
 * «وسائط مجانية» on the home page: the newest items as a row of thumbnails, and the way in
 * to /media. Renders nothing when nothing is published — an empty shelf on the front page
 * is worse than no shelf.
 */
export default function HomeMediaStrip({ items }: { items: PublicMediaItem[] }) {
  const { lang } = useLang();
  const isEn = lang === 'en';
  if (!items.length) return null;
  const t = (ar: string, en: string) => (isEn ? en : ar);

  return (
    <section className="bg-[#1a1a2e] py-10 sm:py-12" dir={isEn ? 'ltr' : 'rtl'} aria-labelledby="home-media-title">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 id="home-media-title" className="text-xl sm:text-2xl font-black text-white">
              🎬 {t('وسائط مجانية', 'Free media')}
            </h2>
            <p className="text-sm text-white/60 mt-1">
              {t('أناشيد، قصص قبل النوم، فيديوهات ورسومات — مجاناً لأطفالك', 'Nasheeds, bedtime stories, videos and drawings — free for your children')}
            </p>
          </div>
          <Link href="/media" className="shrink-0 text-sm font-bold text-[#F5C518] hover:underline underline-offset-4">
            {t('كل الوسائط ←', 'All media →')}
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x" style={{ scrollbarWidth: 'none' }}>
          {items.map(item => {
            const title = isEn && item.titleEn ? item.titleEn : item.title;
            const portrait = item.kind === 'image' || item.kind === 'pdf';
            return (
              <Link
                key={item.id}
                href={`/media/${item.id}`}
                className="group shrink-0 snap-start w-60 sm:w-64 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F5C518]"
              >
                <MediaThumb
                  kind={item.kind}
                  coverUrl={item.coverUrl}
                  title={title}
                  durationSec={item.durationSec}
                  className={`aspect-video ${portrait ? 'bg-white' : ''} transition group-hover:-translate-y-0.5`}
                />
                <p className="mt-2 text-sm font-bold text-white leading-snug line-clamp-2">{title}</p>
                {item.category && (
                  <p className="text-xs text-white/50 mt-0.5">{isEn && item.category.nameEn ? item.category.nameEn : item.category.name}</p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
