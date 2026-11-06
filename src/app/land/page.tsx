'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import Icon, { type IconName } from '@/components/media/Icon';
import { AUD, DISTRICTS, WHO_ORDER, type District, type L, type Who } from './data';
import { Art, Concept, Dot, WhoGrid } from './parts';
import LandMap from './LandMap';

/**
 * «أرض القائد المسلم» — Moslim Leader Land, the future project as its own page.
 *
 * Design: cinematic and contemporary — a full-bleed hero, a moving strip of district
 * names, a manifesto in large type, the principles as a bento grid, «يوم واحد، لكل فرد
 * مساره» (four family members on four paths that meet again), an INTERACTIVE masterplan
 * (tap a district, its panel opens beside the map with what it offers each of the four
 * audiences), and the districts as big picture cards (a bento grid on a computer, a swipe
 * row on a phone). Motion is CSS only and never hides anything: the reveal uses
 * scroll-driven animations where supported and the page is complete without them;
 * everything stops under prefers-reduced-motion. All styles are scoped under `.ld`.
 *
 * The owner's rule for the programme: EVERY district holds something for children, for
 * men only, for women only, and for the family together — so a father can leave his son
 * at a supervised activity and attend something himself. `who` carries those four lists.
 *
 * Content rules: every picture is a CONCEPT image labelled «تصوّر مبدئي»; the map is a
 * «مخطط تصوّري» with no scale and no site; no figures, dates or locations — none were
 * given. Pictures: public/land/ and public/partnership/land-*.webp. A district without a
 * picture gets drawn art; add its image to `img` when one is supplied.
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
        <div className="absolute top-3 end-3 z-10 glass rounded-full w-11 h-11 flex items-center justify-center font-black tabular-nums disp">{d.n}</div>
      </div>
      <div className="flex-1 flex flex-col p-5 sm:p-6 -mt-6 relative">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: `${d.hue}22`, color: d.hue }}>{L(d.tag)}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-white/[0.06] text-[#F5C518]">
            <svg width="13" height="13" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 20h14v-5a7 7 0 0 0-14 0z M13 8V5" /></svg>
            {isEn ? 'Its own mosque' : 'فيها مسجد'}
          </span>
        </div>
        <h3 className="disp mt-3 text-2xl sm:text-[26px] font-extrabold leading-tight">{L(d.title)}</h3>
        <p className="mt-1.5 text-[13px] font-bold" style={{ color: d.hue }}>{isEn ? 'Themed on: ' : 'مستوحاة من: '}{L(d.world)}</p>
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
      { place: { ar: 'الكشافة', en: 'Scouts' }, what: { ar: 'يوصل ابنه إلى قادة الكشافة', en: 'Drops his son with the scout leaders' } },
      { place: { ar: 'الوعي', en: 'Awareness' }, what: { ar: 'يحضر ندوة في ملتقى الآباء', en: 'Attends a talk at the fathers’ forum' } },
      { place: { ar: 'الألعاب', en: 'Games' }, what: { ar: 'تحدٍّ مع الشباب', en: 'A challenge with the youth' } },
    ],
  },
  {
    w: 'women', who: { ar: 'الأم', en: 'The mother' }, steps: [
      { place: { ar: 'نادي السيدات', en: 'Women’s club' }, what: { ar: 'رياضة وعافية بخصوصية', en: 'Private sport and wellbeing' } },
      { place: { ar: 'الوعي', en: 'Awareness' }, what: { ar: 'ملتقى الأمهات', en: 'The mothers’ forum' } },
      { place: { ar: 'الحكايات', en: 'Stories' }, what: { ar: 'عرض خاص بالسيدات', en: 'A women-only screening' } },
    ],
  },
  {
    w: 'kids', who: { ar: 'الابن', en: 'The son' }, steps: [
      { place: { ar: 'الكشافة', en: 'Scouts' }, what: { ar: 'جدار التسلّق والحبال', en: 'The climbing wall and ropes' } },
      { place: { ar: 'الحكايات', en: 'Stories' }, what: { ar: 'قاعة مغامرات الحكاية', en: 'The story adventure hall' } },
      { place: { ar: 'الألعاب', en: 'Games' }, what: { ar: 'لعبة بشخصيات مسلم ليدر', en: 'A Moslim Leader character game' } },
    ],
  },
  {
    w: 'men', who: { ar: 'الجد', en: 'The grandfather' }, steps: [
      { place: { ar: 'الحديقة', en: 'The garden' }, what: { ar: 'مجلس كبار السن', en: 'The elders’ majlis' } },
      { place: { ar: 'الحديقة', en: 'The garden' }, what: { ar: 'يحكي لأحفاده حكايات زمان', en: 'Tells his grandchildren the old stories' } },
      { place: { ar: 'الكشافة', en: 'Scouts' }, what: { ar: 'يزرع مع حفيده شجرة في ركن العطاء', en: 'Plants a tree with his grandson at the Giving Corner' } },
    ],
  },
  {
    w: 'kids', who: { ar: 'الابنة', en: 'The daughter' }, steps: [
      { place: { ar: 'نادي البنات', en: 'Girls’ club' }, what: { ar: 'ركن «حكاية تصنع أثراً»', en: 'The story corner' } },
      { place: { ar: 'نادي البنات', en: 'Girls’ club' }, what: { ar: 'رسم وأشغال', en: 'Drawing and crafts' } },
      { place: { ar: 'الألعاب', en: 'Games' }, what: { ar: 'صالة ألعاب البنات', en: 'The girls’ games hall' } },
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
          <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('يوم واحد، لكل فرد مساره', 'One day, a path for each')}</h2>
        </div>
        <p className="max-w-md text-[#5C6478] leading-relaxed">
          {tx('في كل منطقة ما يناسب الأطفال، وما هو خاص بالرجال، وما هو خاص بالنساء، وما تعيشه الأسرة معاً — فيترك الأب ابنه في نشاط بإشراف، ويحضر هو ما يخصه، ويجد الأجداد مجلسهم، ثم تلتقي الأسرة بأجيالها الثلاثة.', 'Every district holds something for children, something for men only, something for women only, and something the family lives together — so a father leaves his son at a supervised activity and attends his own, the grandparents find their majlis, and the family meets again, all three generations.')}
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
            { ar: 'صلاة الجماعة في المسجد', en: 'Prayer together at the mosque' },
            { ar: 'جلسة في حديقة الساحة', en: 'A seat in the plaza garden' },
            { ar: 'مقهى العائلة', en: 'The family café' },
            { ar: 'عرض سينمائي عائلي', en: 'A family screening' },
            { ar: 'المتجر: خذ الحكاية معك', en: 'The store: take the story home' },
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

  const principles: { n: string; icon: IconName; t: L; s: L; span: string }[] = [
    { n: '01', icon: 'badge', span: 'lg:col-span-2', t: { ar: 'الإحسان', en: 'Ihsan' }, s: { ar: 'إتقان في كل ما نصنع، وأحسن ما يكون في معاملة الناس. هو المعيار الذي تُقاس به كل لعبة وكل خدمة.', en: 'Excellence in everything we make, and our best in how we treat people — the measure of every game and every service.' } },
    { n: '02', icon: 'check', span: '', t: { ar: 'الاقتصاد وعدم التبذير', en: 'Moderation, no waste' }, s: { ar: 'متعة لا تقوم على الإسراف، ولا تعلّم الطفل الاستهلاك.', en: 'Joy that does not rest on excess, nor teach a child to consume.' } },
    { n: '03', icon: 'info', span: '', t: { ar: 'احترام العقل', en: 'Respect for the mind' }, s: { ar: 'نشاط يفتح باب السؤال والفهم، ولا يستخفّ بالطفل.', en: 'Activities that invite questions, never talking down.' } },
    { n: '04', icon: 'heart', span: 'lg:col-span-2', t: { ar: 'روابط الأسرة', en: 'Family bonds' }, s: { ar: 'أنشطة تُعاش معاً، تقرّب الأب والأم من أبنائهما بدل أن ينعزل كلٌّ أمام شاشته.', en: 'Activities lived together, bringing parents closer to their children instead of each to a screen.' } },
  ];

  const names = DISTRICTS.map(d => L(d.title).split(':')[0]);

  return (
    <div className="ld" dir={isEn ? 'ltr' : 'rtl'}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alexandria:wght@500;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,500&display=swap" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── The map, first: the Land is shown as a place to walk through ── */}
      <section id="plan" className="relative bg-[#0A0F1E] text-white overflow-hidden scroll-mt-20">
        <div className="absolute -top-40 end-[-10%] w-[60%] aspect-square rounded-full bg-[#F5C518]/10 blur-3xl" aria-hidden />
        <div className="absolute inset-0 grain opacity-40" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-28 sm:pt-32 pb-16 sm:pb-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
            <div>
              <span className="inline-flex glass rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold text-[#F5C518]">{tx('مشروع مستقبلي · تصوّر مبدئي', 'A future project · Concept')}</span>
              <p className="serif mt-4 text-xl sm:text-2xl text-[#E8C873]" dir="ltr" style={{ textAlign: isEn ? 'left' : 'right' }}>Moslim Leader Land</p>
              <h1 className="disp mt-1 font-black leading-[1.05] text-[44px] sm:text-7xl" style={{ textWrap: 'balance' } as React.CSSProperties}>
                {tx('أرض القائد المسلم', 'The Land of the Muslim Leader')}
              </h1>
              <p className="mt-4 max-w-2xl text-white/75 leading-relaxed">
                {tx('مكان كبير جداً للأسرة المسلمة: ست مناطق حول حديقة كبيرة، لكل فرد فيه مساره وللأسرة لقاؤها، وفي كل منطقة مسجد. تجوّل في الخريطة — اضغط على أي منطقة أو مكان لترى ما فيه.', 'A very large place for the Muslim family: six districts around a large garden, a path for each member and a meeting place for all, and a mosque in every district. Walk the map — tap any district or place to see what is there.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link href="/partnership#request" className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0A0F1E] font-black px-6 py-3 rounded-full hover:bg-white transition">
                {tx('شارك في بنائها', 'Help build it')}
              </Link>
              <a href="#districts" className="glass inline-flex items-center gap-2 text-white font-bold px-5 py-3 rounded-full hover:bg-white/20 transition">
                {tx('المناطق بالتفصيل', 'The districts')} <Icon name="down" size={16} />
              </a>
            </div>
          </div>

          <LandMap isEn={isEn} />

          {/* How the place is organised — the way the great theme parks are, with real worlds
              instead of fantasy ones. */}
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: '1', t: { ar: 'بوابة وشارع سوق', en: 'A gate and a souq street' }, s: { ar: 'يدخل الزائر من البوابة إلى شارع سوق فيه المتجر والمقهى، يقوده إلى قلب المكان.', en: 'Visitors enter through the gate onto a souq street — store and café — that leads to the heart of the place.' } },
              { n: '2', t: { ar: 'حديقة ومَعلَم في المنتصف', en: 'A garden and a landmark' }, s: { ar: 'حديقة كبيرة يتوسطها المرصد، يُرى من كل منطقة فلا يضيع أحد.', en: 'A large garden around the observatory, seen from every district so no one gets lost.' } },
              { n: '3', t: { ar: 'عوالم حقيقية لا خيالية', en: 'Real worlds, not fantasy' }, s: { ar: 'كل منطقة مستوحاة من عالم حقيقي من تاريخنا أو طبيعتنا: الأندلس، بيت الحكمة، الصحراء، رحلات ابن بطوطة.', en: 'Each district is themed on a real world from our history or nature: Andalusia, the House of Wisdom, the desert, Ibn Battuta’s journeys.' } },
              { n: '4', t: { ar: 'ممشى يربط العوالم', en: 'A promenade that links them' }, s: { ar: 'ممشى دائري يمر بكل المناطق، وجواز الرحلة يُختم في كل محطة منه.', en: 'A loop promenade through every district, and a passport stamped at each stop.' } },
            ].map(c => (
              <li key={c.n} className="rounded-2xl bg-white/[0.05] ring-1 ring-white/10 p-5">
                <span className="disp text-[#F5C518] text-3xl font-black tabular-nums">{c.n}</span>
                <h3 className="disp mt-2 text-lg font-extrabold">{L(c.t)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{L(c.s)}</p>
              </li>
            ))}
          </ol>
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

      {/* ── Manifesto ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
        <p className="rise disp text-[28px] sm:text-5xl font-extrabold leading-[1.4] sm:leading-[1.35] text-[#18203A]" style={{ textWrap: 'balance' } as React.CSSProperties}>
          {isEn ? (
            <>A place where a child meets the <span className="text-[#C9A227]">heroes of the stories</span>, the family <span className="text-[#C9A227]">plays together</span>, and parents find <span className="text-[#C9A227]">support</span> — from a forum of ideas to fatwa and counselling.</>
          ) : (
            <>مكان يلتقي فيه الطفل <span className="text-[#C9A227]">أبطال الحكايات</span>، وتلعب فيه الأسرة <span className="text-[#C9A227]">معاً</span>، ويجد فيه الأب والأم <span className="text-[#C9A227]">ما يعينهما</span> — من الملتقى الفكري إلى الفتوى والإرشاد الأسري.</>
          )}
        </p>
      </section>

      {/* ── Principles ── */}
      <section className="bg-[#DDE3EA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-20 sm:py-24">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-sm font-bold text-[#5C6478]">{tx('البصائر', 'The principles')}</p>
              <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('فلسفة واحدة في كل نشاط', 'One philosophy in every activity')}</h2>
            </div>
            <p className="max-w-md text-[#5C6478] leading-relaxed">{tx('من السينما إلى الملاهي ومن الكشافة إلى المقهى — كل ما في المكان يقوم على البصائر نفسها.', 'From the cinema to the rides, from the scouts to the café — everything rests on the same principles.')}</p>
          </div>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map(p => (
              <div key={p.n} className={`rise glass-light rounded-[28px] p-6 sm:p-7 min-h-[220px] flex flex-col justify-between ${p.span}`}>
                <div className="flex items-start justify-between">
                  <span className="w-12 h-12 rounded-2xl bg-[#0A0F1E] text-[#F5C518] inline-flex items-center justify-center"><Icon name={p.icon} size={22} /></span>
                  <span className="disp text-5xl font-black text-[#0A0F1E]/10 tabular-nums" dir="ltr">{p.n}</span>
                </div>
                <div>
                  <h3 className="disp mt-6 text-2xl sm:text-[28px] font-extrabold">{L(p.t)}</h3>
                  <p className="mt-2 text-[#5C6478] leading-relaxed">{L(p.s)}</p>
                </div>
              </div>
            ))}
            <div className="rise sm:col-span-2 lg:col-span-4 rounded-[28px] bg-[#0A0F1E] text-white p-6 sm:p-7 flex flex-col md:flex-row md:items-center gap-4">
              <span className="disp shrink-0 text-xl font-extrabold text-[#F5C518]">{tx('لا مكان هنا لـ', 'No place here for')}</span>
              <ul className="flex flex-wrap gap-2">
                {[
                  { ar: 'الفردية والأنانية', en: 'Individualism and selfishness' },
                  { ar: 'الممارسات الإدمانية', en: 'Addictive practices' },
                  { ar: 'بيت الرعب والخوف كمتعة', en: 'Horror houses, fear as fun' },
                  { ar: 'ما يعرّض حياة أحد للخطر', en: 'Anything that risks a life' },
                ].map(r => (
                  <li key={r.ar} className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold">
                    <Icon name="close" size={14} className="text-[#F5A5A5]" /> {L(r)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── One day, a path for each ── */}
      <FamilyDay isEn={isEn} />

      {/* ── The districts ── */}
      <section id="districts" className="max-w-7xl mx-auto px-4 sm:px-8 py-20 sm:py-24 scroll-mt-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-bold text-[#5C6478]">{tx('المناطق', 'The districts')}</p>
            <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('أماكن تعيش فيها القيم', 'Places where values are lived')}</h2>
          </div>
          <p className="max-w-md text-[#5C6478] leading-relaxed lg:hidden">{tx('اسحب لترى كل المناطق.', 'Swipe to see every district.')}</p>
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
            <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('أرض القائد المسلم تُبنى مع شركاء', 'The Land is built with partners')}</h2>
            <p className="mt-4 text-white/75 leading-relaxed">
              {tx('هذا مشروع مستقبلي وتصوّر مبدئي، يتطوّر مع الشركاء ودراسة كل موقع. إن كنت مستثمراً أو مشغّلاً أو جهة تؤمن بالفكرة، فمكانك معنا.', 'A future project and an early concept that grows with partners and the study of each site. If you are an investor, an operator or an organisation that believes in it, there is a place for you.')}
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
