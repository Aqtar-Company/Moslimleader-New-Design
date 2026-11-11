'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import Icon from '@/components/media/Icon';
import { DISTRICTS, type District, type L } from './data';
import { Art, Concept, WhoGrid } from './parts';
import LandMap from './LandMap';
import Characters from './Characters';
import { ui } from './land-data';

/**
 * «أرض القائد المسلم» — Moslim Leader Land, the future project as its own page.
 *
 * The idea, in the owner's words: «روّحوا القلوبَ ساعةً بعد ساعة» (attributed to Imam Ali,
 * so it is introduced with «يُروى عن»). The family comes in to rest and leaves more united —
 * things that strengthen its bonds, its minds and its thinking; no triviality, no waste.
 *
 * Order: the interactive map first (LandMap.tsx, designed in Lovable) with the characters
 * under it (Characters.tsx), the parts of the Land as cards, a gallery strip, and the call
 * to partners. (The yellow moving strip, the «روّحوا القلوب» quote section and «لكل فرد مساره»
 * were removed at the owner's request, 2026-11-11 — do not bring them back.)
 *
 * Writing rules the owner set — keep them:
 *  - Refined Arabic, no borrowed Western words: no «ملاهي», no «سينما» («دار العرض», «دار
 *    الألعاب» instead). No storybook tone («أبطال الحكايات» and the like).
 *  - No counts («ست مناطق») and nothing invented: only what the owner described or showed.
 *  - Every part holds something for children, men only, women only, and the family
 *    together (`who` in data.ts); every part has a mosque.
 *  - Every picture is a CONCEPT image labelled «تصوّر مبدئي»; the map is a «مخطط تصوّري».
 *
 * All styles are scoped under `.ld`; motion is CSS only and stops under reduced motion.
 */

const GALLERY = [
  '/land/store.webp', '/partnership/land-stories.webp', '/land/girls-stories.webp', '/land/scouts-climbing.webp',
  '/partnership/land-cafe.webp', '/land/youth-salon.webp', '/partnership/land-prayer.webp', '/partnership/land-scouts.webp',
];

const CSS = `
.ld{--ink:#0A0F1E;--gold:#F5C518;--champ:#E8C873;--ivory:#F6F2E9;--mist:#DDE3EA;--text:#18203A;--muted:#5C6478;
  font-family:'IBM Plex Sans Arabic','Cairo',system-ui,sans-serif;color:var(--text);background:var(--ivory)}
.ld .disp{font-family:'Alexandria','Noto Kufi Arabic','Cairo',sans-serif;letter-spacing:-.01em}
.ld .serif{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:500}
.ld .glass{background:rgba(255,255,255,.12);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(255,255,255,.22)}
.ld .glass-light{background:rgba(255,255,255,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.9)}
.ld .grain{background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);background-size:3px 3px}
@keyframes ld-zoom{from{transform:scale(1.12)}to{transform:scale(1)}}
.ld .kb{animation:ld-zoom 16s ease-out both}
@keyframes ld-marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.ld .marq{animation:ld-marq 38s linear infinite}
.ld .marq-slow{animation:ld-marq 70s linear infinite}
.ld .marq-wrap:hover .marq,.ld .marq-wrap:hover .marq-slow{animation-play-state:paused}
@keyframes ld-rise{from{opacity:.25;transform:translateY(28px)}to{opacity:1;transform:none}}
@supports (animation-timeline: view()){
  .ld .rise{animation:ld-rise linear both;animation-timeline:view();animation-range:entry 0% cover 28%}
}
@keyframes ld-glow{0%,100%{opacity:.35}50%{opacity:.8}}
.ld .glow{animation:ld-glow 3.2s ease-in-out infinite}
.ld .card-img{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.ld .card:hover .card-img{transform:scale(1.06)}
.ld .snap{scroll-snap-type:x mandatory;scrollbar-width:none}
.ld .snap::-webkit-scrollbar{display:none}
.ld .snap>*{scroll-snap-align:start}
@keyframes lm-walk{to{stroke-dashoffset:-300}}
.ld .lm-walk{animation:lm-walk 12s linear infinite}
@keyframes lm-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.2);opacity:0}}
.ld .lm-ping{animation:lm-ping 2.4s cubic-bezier(0,0,.2,1) infinite}
.ld .lm-block{transition:opacity .3s}
.ld .lm-block:hover rect:nth-child(2){fill-opacity:.5}
@media (prefers-reduced-motion: reduce){.ld .lm-walk,.ld .lm-ping{animation:none!important}.ld .kb,.ld .marq,.ld .marq-slow,.ld .rise,.ld .glow{animation:none!important}.ld .card-img{transition:none}}
`;

function DistrictCard({ d, isEn }: { d: District; isEn: boolean }) {
  const L = (l: L) => (isEn ? l.en : l.ar);
  return (
    <article id={`d-${d.id}`} className="card rise scroll-mt-28 h-full flex flex-col overflow-hidden rounded-[28px] bg-[#0F1630] text-white ring-1 ring-white/5">
      {/* The picture on top, the words below it on solid ground — text over a busy concept
          image could not be read. */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {d.img ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.img} alt="" loading="lazy" className="card-img absolute inset-0 w-full h-full object-cover" />
            <Concept isEn={isEn} />
          </>
        ) : <Art d={d} />}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0F1630] to-transparent" aria-hidden />
        <div className="absolute top-3 end-3 z-10 glass rounded-full w-11 h-11 flex items-center justify-center"><Icon name={d.icon} size={20} /></div>
      </div>
      <div className="flex-1 flex flex-col p-5 sm:p-6 -mt-6 relative">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: `${d.hue}22`, color: d.hue }}>{L(d.tag)}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-white/[0.06] text-[#F5C518]">
            <svg width="13" height="13" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 20h14v-5a7 7 0 0 0-14 0z M13 8V5" /></svg>
            {isEn ? 'Its own mosque' : 'فيه مسجد'}
          </span>
        </div>
        <h3 className="disp mt-3 text-2xl sm:text-[26px] font-extrabold leading-tight">{L(d.title)}</h3>
        {/* Four lines on the card; the whole text is in the plan's panel. */}
        <p className="mt-2 text-sm leading-relaxed text-white/70 line-clamp-4" title={L(d.intro)}>{L(d.intro)}</p>
        <div className="mt-auto pt-5"><WhoGrid d={d} isEn={isEn} /></div>
      </div>
    </article>
  );
}

export default function LandPage() {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  const L = (l: L) => (isEn ? l.en : l.ar);

  return (
    <div className="ld" dir={isEn ? 'ltr' : 'rtl'}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,500&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── The map, first — the header, map and characters are the owner's Lovable design
          (LandMap.tsx, Characters.tsx); the sections after it are this page's own. ── */}
      <section id="plan" className="relative bg-[#0A0F1E] text-[#F6F2E9] overflow-hidden scroll-mt-20" style={{ fontFamily: "'Alexandria', 'Noto Kufi Arabic', sans-serif" }}>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-28 sm:pt-32 pb-16 sm:pb-20 min-w-0">
          <header className="mb-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/land/map/logo-wide.webp" alt={tx('شعار مسلم ليدر', 'Moslim Leader logo')} width={1200} height={283} className="mx-auto hidden w-full max-w-2xl sm:block" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/land/map/logo-tall.webp" alt={tx('شعار مسلم ليدر', 'Moslim Leader logo')} width={420} height={507} className="mx-auto h-28 w-auto sm:hidden" />
            <p className="mt-5 text-sm text-[#E8C873]">{L(ui.saying)}</p>
            <h1 className="mt-3 text-3xl font-bold text-[#F5C518] sm:text-5xl">{L(ui.heading)}</h1>
            <p lang={isEn ? 'ar' : 'en'} className="mt-2 text-sm text-[#E8C873]/80" style={isEn ? undefined : { fontFamily: "'Manrope', sans-serif" }}>{isEn ? ui.heading.ar : ui.heading.en}</p>
            <p className="mt-3 text-lg text-[#BDB5A3]">{L(ui.subheading)}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/partnership#request" className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0A0F1E] font-bold px-6 py-2.5 rounded-full hover:bg-white transition">
                {tx('شارك في بنائها', 'Help build it')}
              </Link>
              <a href="#districts" className="inline-flex items-center gap-2 border border-white/15 text-[#F6F2E9] font-bold px-5 py-2.5 rounded-full hover:bg-white/10 transition">
                {tx('أركان المكان', 'The parts of the Land')} <Icon name="down" size={16} />
              </a>
            </div>
          </header>

          <LandMap lang={isEn ? 'en' : 'ar'} />
          <Characters lang={isEn ? 'en' : 'ar'} />
        </div>
      </section>

      {/* ── The districts ── */}
      <section id="districts" className="max-w-7xl mx-auto px-4 sm:px-8 py-20 sm:py-24 scroll-mt-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-bold text-[#5C6478]">{tx('أركان المكان', 'The parts of the Land')}</p>
            <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('في كل ركن ما يخص كل فرد', 'Something for everyone, in every part')}</h2>
          </div>
          <p className="max-w-md text-[#5C6478] leading-relaxed lg:hidden">{tx('اسحب لترى بقية الأركان.', 'Swipe to see the other parts.')}</p>
        </div>
        {/* Phone: a swipe row. Computer: three equal columns. */}
        <div className="snap -mx-4 px-4 flex gap-3 overflow-x-auto pb-2 lg:mx-0 lg:px-0 lg:overflow-visible lg:grid lg:grid-cols-3 lg:gap-5">
          {[...DISTRICTS].sort((a, b) => a.n - b.n).map(d => (
            <div key={d.id} className="shrink-0 w-[88%] sm:w-[60%] lg:w-auto">
              <DistrictCard d={d} isEn={isEn} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Gallery strip ── */}
      <section className="marq-wrap overflow-hidden pb-20 sm:pb-24" dir="ltr" aria-label={tx('تصوّرات مبدئية', 'Concept visuals')}>
        <div className="marq-slow flex w-max gap-4">
          {[...GALLERY, ...GALLERY].map((src, i) => (
            <figure key={i} className="relative shrink-0 w-[300px] sm:w-[460px] aspect-[16/9] rounded-[24px] overflow-hidden bg-[#0A0F1E]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            </figure>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-[#5C6478]">{tx('كل الصور تصوّرات مبدئية لمشروع مستقبلي', 'All images are concept visuals of a future project')}</p>
      </section>

      {/* ── Build it with us ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-20 sm:pb-28">
        <div className="relative overflow-hidden rounded-[36px] bg-[#0A0F1E] text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/land/scouts-climbing.webp" alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-l from-[#0A0F1E] via-[#0A0F1E]/85 to-[#0A0F1E]/40" aria-hidden />
          <div className="relative p-8 sm:p-14 max-w-2xl">
            <p className="serif text-xl text-[#E8C873]" dir="ltr" style={{ textAlign: isEn ? 'left' : 'right' }}>Build it with us</p>
            <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('نبنيها مع من يؤمن بها', 'We build it with those who believe in it')}</h2>
            <p className="mt-4 text-white/75 leading-relaxed">
              {tx('أرض القائد المسلم مشروع مستقبلي، وما في هذه الصفحة تصوّر مبدئي يكتمل مع الشركاء ودراسة كل موقع. إن كنت مستثمراً أو مشغّلاً أو جهة ترى في الأسرة المسلمة ما نراه، فمكانك معنا.', 'Moslim Leader Land is a future project, and this page is an early concept completed with partners and the study of each site. If you are an investor, an operator or an organisation that sees in the Muslim family what we see, there is a place for you.')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/partnership#request" className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0A0F1E] font-black px-7 py-3.5 rounded-full hover:bg-white transition">
                {tx('قدّم طلب الشراكة', 'Apply to partner')}
              </Link>
              <Link href="/partnership#land" className="glass inline-flex items-center gap-2 text-white font-bold px-6 py-3.5 rounded-full hover:bg-white/20 transition">
                {tx('في التصور الاستراتيجي', 'In the strategy deck')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
