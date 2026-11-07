'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import Icon from '@/components/media/Icon';
import { AUD, DISTRICTS, WHO_ORDER, type District, type L, type Who } from './data';
import { Art, Concept, Dot, WhoGrid } from './parts';
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
 * under it (Characters.tsx), the moving strip, the founding idea, «لكل
 * فرد مساره» (a day told as four paths that meet), the parts of the Land as cards, a gallery
 * strip, and the call to partners.
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

/**
 * «يوم واحد، لكل فرد مساره» — the owner's idea told as a day: four members of one family on
 * four paths through the place, which meet again at the end. Illustrative, not a timetable.
 */
type Step = { place: L; what: L };
const JOURNEYS: { w: Who; who: L; steps: Step[] }[] = [
  {
    w: 'men', who: { ar: 'الأب', en: 'The father' }, steps: [
      { place: { ar: 'الكشافة', en: 'The Scouts' }, what: { ar: 'يترك ابنه مع قادة الكشافة', en: 'Leaves his son with the scout leaders' } },
      { place: { ar: 'الملتقى', en: 'The Forum' }, what: { ar: 'يحضر مجلساً في ملتقى الآباء', en: 'Attends a session at the fathers’ forum' } },
      { place: { ar: 'المسجد', en: 'The mosque' }, what: { ar: 'يصلّي مع ابنه', en: 'Prays with his son' } },
    ],
  },
  {
    w: 'women', who: { ar: 'الأم', en: 'The mother' }, steps: [
      { place: { ar: 'نادي السيدات', en: 'The Women’s Club' }, what: { ar: 'رياضة وعافية بخصوصية', en: 'Sport and wellbeing in privacy' } },
      { place: { ar: 'الملتقى', en: 'The Forum' }, what: { ar: 'ملتقى الأمهات', en: 'The mothers’ forum' } },
      { place: { ar: 'نادي البنات', en: 'The Girls’ Club' }, what: { ar: 'تلحق بابنتها', en: 'Joins her daughter' } },
    ],
  },
  {
    w: 'kids', who: { ar: 'الابن', en: 'The son' }, steps: [
      { place: { ar: 'الكشافة', en: 'The Scouts' }, what: { ar: 'التسلّق والحبال', en: 'Climbing and ropes' } },
      { place: { ar: 'الكشافة', en: 'The Scouts' }, what: { ar: 'ركن العطاء', en: 'The Giving Corner' } },
      { place: { ar: 'دار الألعاب', en: 'The House of Games' }, what: { ar: 'لعبة «ذاكر»', en: 'The Zaker game' } },
    ],
  },
  {
    w: 'kids', who: { ar: 'الابنة', en: 'The daughter' }, steps: [
      { place: { ar: 'نادي البنات', en: 'The Girls’ Club' }, what: { ar: 'ركن «حكاية تصنع أثراً»', en: 'The «A story that leaves a mark» corner' } },
      { place: { ar: 'نادي البنات', en: 'The Girls’ Club' }, what: { ar: 'رياضة البنات', en: 'Sport for girls' } },
      { place: { ar: 'دار الألعاب', en: 'The House of Games' }, what: { ar: 'لعبة «رحيمة»', en: 'The Rahima game' } },
    ],
  },
  {
    w: 'men', who: { ar: 'الجد', en: 'The grandfather' }, steps: [
      { place: { ar: 'الحديقة الكبرى', en: 'The Great Garden' }, what: { ar: 'مجلس كبار السن', en: 'The elders’ majlis' } },
      { place: { ar: 'الحديقة الكبرى', en: 'The Great Garden' }, what: { ar: 'يحكي لأحفاده', en: 'Tells his grandchildren the old stories' } },
    ],
  },
];

function FamilyDay({ isEn }: { isEn: boolean }) {
  const L = (l: L) => (isEn ? l.en : l.ar);
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20 sm:py-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-sm font-bold text-[#5C6478]">{tx('لكل الأعمار', 'For every age')}</p>
          <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('لكل فرد مساره، وللأسرة لقاؤها', 'A path for each, a meeting for all')}</h2>
        </div>
        <p className="max-w-md text-[#5C6478] leading-relaxed">
          {tx('في كل ركن ما يخص الأطفال، وما يخص الرجال، وما يخص النساء، وما تعيشه الأسرة مجتمعة. يترك الأب ابنه في نشاط بإشراف ويحضر ما يخصه، وتمضي الأم إلى ما يخصها، ويجد الأجداد مجلسهم — ثم تلتقي الأسرة.', 'Every part holds something for children, for men, for women, and for the family together. A father leaves his son at a supervised activity and attends his own, the mother goes to hers, the grandparents find their majlis — and then the family meets.')}
        </p>
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap gap-2 mb-6">
        {WHO_ORDER.map(w => (
          <li key={w} className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold border border-[#0A0F1E]/5"><Dot w={w} size={10} />{isEn ? AUD[w].en : AUD[w].ar}</li>
        ))}
      </ul>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {JOURNEYS.map((j, idx) => (
          <div key={j.who.ar} className={`rise rounded-[28px] bg-white p-5 sm:p-6 border border-[#0A0F1E]/5 relative overflow-hidden ${idx === JOURNEYS.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
            <div className="absolute top-0 inset-x-0 h-1.5" style={{ background: AUD[j.w].dot }} aria-hidden />
            <p className="disp text-2xl font-extrabold">{L(j.who)}</p>
            <ol className="mt-5 relative">
              {/* The path */}
              <span className="absolute top-2 bottom-2 start-[7px] w-0.5 rounded-full" style={{ background: `${AUD[j.w].dot}66` }} aria-hidden />
              {j.steps.map((s, i) => (
                <li key={i} className="relative ps-7 pb-5 last:pb-0">
                  <span className="absolute start-0 top-1 w-4 h-4 rounded-full border-[3px] bg-white" style={{ borderColor: AUD[j.w].dot }} aria-hidden />
                  <p className="text-[11px] font-bold text-[#5C6478]">{L(s.place)}</p>
                  <p className="font-bold leading-snug">{L(s.what)}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Where the paths meet */}
      <div className="rise mt-4 rounded-[28px] bg-[#0A0F1E] text-white p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center gap-5 relative overflow-hidden">
        <div className="absolute -end-20 -top-20 w-72 h-72 rounded-full bg-[#9BCB8F]/15 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3 shrink-0">
          <span className="flex -space-x-2 rtl:space-x-reverse" aria-hidden>
            {(['men', 'women', 'men', 'kids', 'kids'] as Who[]).map((w, i) => (
              <span key={i} className="w-9 h-9 rounded-full ring-2 ring-[#0A0F1E]" style={{ background: AUD[w].dot }} />
            ))}
          </span>
          <p className="disp text-2xl font-extrabold">{tx('ثم تلتقي الأسرة', 'Then the family meets')}</p>
        </div>
        <ol className="relative flex flex-wrap gap-2 lg:ms-auto">
          {[
            { ar: 'صلاة الجماعة', en: 'Prayer together' },
            { ar: 'جلسة في الحديقة الكبرى', en: 'A seat in the Great Garden' },
            { ar: 'مقهى العائلة', en: 'The family café' },
            { ar: 'عرض في دار العرض', en: 'A screening together' },
          ].map((s, i) => (
            <li key={s.ar} className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold text-sm">
              <span className="w-5 h-5 rounded-full bg-[#9BCB8F] text-[#0A0F1E] text-[11px] font-black inline-flex items-center justify-center tabular-nums">{i + 1}</span>
              {L(s)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function LandPage() {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  const L = (l: L) => (isEn ? l.en : l.ar);

  const names = [...DISTRICTS].sort((a, b) => a.n - b.n).map(d => L(d.title));

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

      {/* ── Moving strip ── */}
      <div className="marq-wrap bg-[#F5C518] text-[#0A0F1E] overflow-hidden py-3.5" dir="ltr" aria-hidden>
        <div className="marq flex w-max gap-8 whitespace-nowrap">
          {[...names, ...names, ...names, ...names].map((n, i) => (
            <span key={i} className="disp inline-flex items-center gap-8 text-lg sm:text-xl font-extrabold" dir={isEn ? 'ltr' : 'rtl'}>
              {n}<span className="text-[#0A0F1E]/40">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── The founding idea ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
        <figure className="rise">
          <blockquote className="disp text-[34px] sm:text-6xl font-black leading-[1.25] text-[#18203A]" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {isEn ? '“Refresh the hearts, hour after hour.”' : '«روّحوا القلوبَ ساعةً بعد ساعة»'}
          </blockquote>
          <figcaption className="mt-4 text-[#5C6478] font-bold">{tx('يُروى عن الإمام علي بن أبي طالب رضي الله عنه', 'Attributed to Imam Ali ibn Abi Talib')}</figcaption>
        </figure>
        <div className="rise mt-10 grid gap-6 md:grid-cols-2 text-lg leading-loose text-[#18203A]">
          <p>
            {tx(
              'على هذا المعنى تقوم أرض القائد المسلم. الترويح عندنا ليس هروباً من الحياة ولا استهلاكاً لها، بل استراحةٌ تعيد للقلب صفاءه، وتعيد الأسرة إلى بعضها.',
              'Moslim Leader Land is built on that meaning. Recreation, for us, is neither an escape from life nor a way of consuming it, but a rest that restores the heart and brings a family back to itself.',
            )}
          </p>
          <p>
            {tx(
              'تدخلها الأسرة لتستريح، وتخرج منها أشدّ تماسكاً: كل ما فيها يقوّي روابطها، ويغذّي عقولها، ويوسّع فكرها. لا تفاهة فيها ولا إسراف، ولا ما يُدمن عليه الطفل أو يعزله عن أهله، ولا بيت رعب ولا ما يعرّض حياةً للخطر.',
              'A family enters it to rest and leaves it more united: everything in it strengthens their bonds, feeds their minds and widens their thinking. No triviality, no waste, nothing that hooks a child or cuts them off from their family, no horror house and nothing that risks a life.',
            )}
          </p>
        </div>
      </section>

      {/* ── One day, a path for each ── */}
      <FamilyDay isEn={isEn} />

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
