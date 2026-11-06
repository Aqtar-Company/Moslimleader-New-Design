'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import Icon, { type IconName } from '@/components/media/Icon';

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

type L = { ar: string; en: string };
type Who = 'kids' | 'men' | 'women' | 'family';
type District = {
  id: string;
  n: number;
  icon: IconName;
  hue: string;
  title: L;
  tag: L;
  intro: L;
  /** What it offers each audience. An empty list is shown as «خاص بـ…» by `onlyFor`. */
  who: Record<Who, L[]>;
  onlyFor?: Who;
  img?: string;
};

const AUD: Record<Who, { ar: string; en: string; dot: string }> = {
  kids: { ar: 'للأطفال', en: 'Children', dot: '#F5C518' },
  men: { ar: 'للرجال', en: 'Men', dot: '#7FB2E5' },
  women: { ar: 'للنساء', en: 'Women', dot: '#E7A9BD' },
  family: { ar: 'للأسرة معاً', en: 'The family together', dot: '#9BCB8F' },
};
const WHO_ORDER: Who[] = ['kids', 'men', 'women', 'family'];

const DISTRICTS: District[] = [
  {
    id: 'stories', n: 1, icon: 'book', hue: '#E8C873', img: '/partnership/land-stories.webp',
    title: { ar: 'عالم الحكايات والسينما', en: 'Stories & Cinema' },
    tag: { ar: 'من الرواية إلى التجربة', en: 'From the novel to the experience' },
    intro: {
      ar: 'تخرج قصص مسلم ليدر من الكتاب: أفلام من رواياتها على الشاشة الكبيرة، وقاعة مغامرات يدخل فيها الطفل إلى القصة، وشخصيات يلتقيها ويتصوّر معها.',
      en: 'Moslim Leader’s stories leave the book: films from its novels on the big screen, an adventure hall that takes a child inside the story, and characters to meet.',
    },
    who: {
      kids: [{ ar: 'قاعة مغامرات الحكاية', en: 'Story Adventure Hall' }, { ar: 'لقاء الشخصيات', en: 'Meet the characters' }],
      men: [{ ar: 'عروض وثائقية وفكرية', en: 'Documentary & ideas screenings' }],
      women: [{ ar: 'عروض وجلسات خاصة بالسيدات', en: 'Women-only screenings' }],
      family: [{ ar: 'عرض سينمائي عائلي من روايات مسلم ليدر', en: 'Family screenings of Moslim Leader novels' }],
    },
  },
  {
    id: 'girls', n: 4, icon: 'heart', hue: '#E7A9BD', img: '/land/girls-stories.webp', onlyFor: 'women',
    title: { ar: 'نادي البنات والسيدات', en: 'Girls’ & Women’s Club' },
    tag: { ar: 'خصوصية وعافية ومجتمع', en: 'Privacy, wellbeing, community' },
    intro: {
      ar: 'مساحة خاصة بالبنات والسيدات تحفظ خصوصيتهن: رياضة وعافية، وجلسات حكي، ورسم وأشغال، ولقاءات تجمع الأمهات.',
      en: 'A space of the girls’ and women’s own, private by design: sport and wellbeing, storytelling, crafts, and gatherings for mothers.',
    },
    who: {
      kids: [{ ar: 'ركن «حكاية تصنع أثراً» للبنات', en: 'The girls’ story corner' }, { ar: 'رياضة البنات', en: 'Girls’ sport' }],
      men: [],
      women: [{ ar: 'رياضة وعافية بخصوصية', en: 'Private sport & wellbeing' }, { ar: 'لقاءات الأمهات', en: 'Mothers’ gatherings' }],
      family: [{ ar: 'أمسيات الأم وابنتها', en: 'Mother-and-daughter evenings' }],
    },
  },
  {
    id: 'scouts', n: 3, icon: 'badge', hue: '#B9C79A', img: '/land/scouts-climbing.webp',
    title: { ar: 'الكشافة والمغامرة', en: 'Scouts & Adventure' },
    tag: { ar: 'شخصية قوية وغد أفضل', en: 'Strong character, brighter tomorrow' },
    intro: {
      ar: 'حبال وعُقد، وجدار تسلّق، وجسور معلّقة، وتخييم بإشراف قادة — مغامرة تبني الشجاعة والانضباط وروح الفريق.',
      en: 'Ropes and knots, a climbing wall, rope bridges and camping under trained leaders — adventure that builds courage, discipline and team spirit.',
    },
    who: {
      kids: [{ ar: 'الكشافة للأولاد بإشراف قادة', en: 'Supervised scouts for boys' }],
      men: [{ ar: 'تحديات الآباء والشباب', en: 'Challenges for fathers & youth' }, { ar: 'صالون الرجال', en: 'Men’s salon' }],
      women: [{ ar: 'رحلات طبيعة خاصة بالسيدات والبنات', en: 'Women-and-girls nature outings' }],
      family: [{ ar: 'تخييم عائلي', en: 'Family camping' }],
    },
  },
  {
    id: 'games', n: 2, icon: 'zap', hue: '#8FC3D1',
    title: { ar: 'الألعاب والملاهي', en: 'Games & Rides' },
    tag: { ar: 'ترفيه يحترم الهوية', en: 'Fun that respects identity' },
    intro: {
      ar: 'ملاهٍ وألعاب فيديو بمفهوم إسلامي، أبطالها شخصيات مسلم ليدر — يكسب فيها الطفل بالمساعدة والقراءة والعمل الطيب.',
      en: 'Rides and video games on an Islamic concept, starring the Moslim Leader characters — where a child scores by helping, reading and doing good.',
    },
    who: {
      kids: [{ ar: 'ألعاب بشخصيات مسلم ليدر', en: 'Character video games' }, { ar: 'أماكن لعب بإشراف', en: 'Supervised play areas' }],
      men: [{ ar: 'مسابقات وتحديات للشباب والآباء', en: 'Contests for youth & fathers' }],
      women: [{ ar: 'صالة ألعاب للبنات والسيدات', en: 'A games hall for girls & women' }],
      family: [{ ar: 'ملاهٍ وألعاب جماعية للأسرة', en: 'Rides and team games for families' }],
    },
  },
  {
    id: 'family', n: 5, icon: 'comment', hue: '#B7A9DA',
    title: { ar: 'الوعي: الأسرة والفكر', en: 'Awareness: Family & Thought' },
    tag: { ar: 'نبني أسرة واعية', en: 'Building a mindful family' },
    intro: {
      ar: 'ملتقى ثقافي وفكري عن الأسرة ودعمها، ومركز للفتوى والإرشاد يعين الزوجين على حل خلافاتهما — بينما يتعلّم الأبناء في ورش القيم بجوار آبائهم.',
      en: 'A cultural and intellectual forum on the family, and a fatwa and counselling centre that helps couples resolve disputes — while the children learn in values workshops next door.',
    },
    who: {
      kids: [{ ar: 'ورش القيم: الإنصات والتعاون واللطف', en: 'Values workshops: listening, cooperation, kindness' }],
      men: [{ ar: 'ملتقى الآباء وندوات فكرية', en: 'Fathers’ forum & talks' }, { ar: 'مركز الفتوى', en: 'Fatwa centre' }],
      women: [{ ar: 'ملتقى الأمهات', en: 'Mothers’ forum' }, { ar: 'الإرشاد الأسري', en: 'Family counselling' }],
      family: [{ ar: 'ورش الآباء والأبناء معاً', en: 'Parent-and-child workshops' }, { ar: 'الإرشاد الزوجي', en: 'Marriage counselling' }],
    },
  },
  {
    id: 'plaza', n: 6, icon: 'moon', hue: '#F5C518', img: '/partnership/land-cafe.webp',
    title: { ar: 'الساحة: المصلى والمقهى والمتجر', en: 'The Plaza: Prayer, Café, Store' },
    tag: { ar: 'قلب المكان', en: 'The heart of the place' },
    intro: {
      ar: 'هنا تلتقي الطرق وتجتمع الأسرة من جديد: المصلى في قلب التجربة، ومقهى العائلة للاستراحة — فاليوم هنا طويل — ومتجر مسلم ليدر. ومن البوابة يبدأ الطفل رحلته بجواز يُختم في كل منطقة.',
      en: 'Where the paths meet and the family gathers again: prayer at the heart of the experience, the family café — the day is long — and the Moslim Leader store. At the gate a child starts the journey with a passport stamped in every district.',
    },
    who: {
      kids: [{ ar: 'جواز الرحلة يُختم في كل منطقة', en: 'A passport stamped in every district' }],
      men: [{ ar: 'المصلى', en: 'The prayer hall' }],
      women: [{ ar: 'مصلى السيدات', en: 'The women’s prayer hall' }],
      family: [{ ar: 'مقهى العائلة', en: 'The family café' }, { ar: 'متجر مسلم ليدر', en: 'The Moslim Leader store' }],
    },
  },
];

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
@media (prefers-reduced-motion: reduce){.ld .kb,.ld .marq,.ld .marq-slow,.ld .rise,.ld .glow{animation:none!important}.ld .card-img{transition:none}}
`;

function Concept({ isEn }: { isEn: boolean }) {
  return (
    <span className="absolute top-3 start-3 z-10 rounded-full px-3 py-1 text-[11px] font-bold glass text-white">
      {isEn ? 'Concept visual' : 'تصوّر مبدئي'}
    </span>
  );
}

function Dot({ w, size = 8 }: { w: Who; size?: number }) {
  return <span className="shrink-0 rounded-full inline-block" style={{ width: size, height: size, background: AUD[w].dot }} aria-hidden />;
}

/** Drawn art for a district that has no picture yet: its mark, large, over its own hue. */
function Art({ d }: { d: District }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(120% 90% at 80% 10%, ${d.hue}55 0%, transparent 55%), linear-gradient(160deg, #18224A 0%, #0A0F1E 100%)` }}>
      <div className="absolute inset-0 grain opacity-60" aria-hidden />
      <div className="absolute -bottom-10 -start-10 w-[70%] aspect-square rounded-full border" style={{ borderColor: `${d.hue}55` }} aria-hidden />
      <div className="absolute -bottom-24 -start-24 w-[95%] aspect-square rounded-full border" style={{ borderColor: `${d.hue}30` }} aria-hidden />
      <span className="absolute top-[16%] end-[12%] text-white/90" aria-hidden style={{ filter: `drop-shadow(0 0 30px ${d.hue})` }}>
        <Icon name={d.icon} size={110} strokeWidth={1} />
      </span>
    </div>
  );
}

/** What a district offers each audience — the four lanes, in one compact block. */
function WhoGrid({ d, isEn, dark = true }: { d: District; isEn: boolean; dark?: boolean }) {
  const L = (l: L) => (isEn ? l.en : l.ar);
  return (
    <div className="grid grid-cols-2 gap-2">
      {WHO_ORDER.map(w => {
        const items = d.who[w];
        const empty = items.length === 0;
        return (
          <div key={w} className={`rounded-2xl p-3 ${dark ? 'bg-white/[0.06]' : 'bg-white'} ${empty ? 'opacity-60' : ''}`}>
            <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: AUD[w].dot }}>
              <Dot w={w} /> {isEn ? AUD[w].en : AUD[w].ar}
            </p>
            {empty ? (
              <p className={`mt-1 text-[13px] ${dark ? 'text-white/60' : 'text-[#5C6478]'}`}>
                {d.onlyFor ? (isEn ? `${AUD[d.onlyFor].en} only` : `خاص ${AUD[d.onlyFor].ar.replace('لل', 'بال')}`) : '—'}
              </p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {items.map(it => <li key={it.ar} className="text-[13px] font-semibold leading-snug">{L(it)}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
        <span className="self-start rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: `${d.hue}22`, color: d.hue }}>{L(d.tag)}</span>
        <h3 className="disp mt-3 text-2xl sm:text-[26px] font-extrabold leading-tight">{L(d.title)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{L(d.intro)}</p>
        <div className="mt-auto pt-5"><WhoGrid d={d} isEn={isEn} /></div>
      </div>
    </article>
  );
}

/** The masterplan: six districts around the plaza, the gate below. Tap a block to open its panel. */
function Masterplan({ isEn, active, onPick }: { isEn: boolean; active: string; onPick: (id: string) => void }) {
  const by = Object.fromEntries(DISTRICTS.map(x => [x.id, x])) as Record<string, District>;
  const label = (x: District) => (isEn ? x.title.en : x.title.ar).split(':')[isEn ? 0 : 0].trim();
  const blocks: { id: string; x: number; y: number; w: number; h: number }[] = [
    { id: 'stories', x: 470, y: 30, w: 300, h: 150 },
    { id: 'games', x: 30, y: 30, w: 300, h: 150 },
    { id: 'girls', x: 560, y: 225, w: 210, h: 170 },
    { id: 'scouts', x: 30, y: 225, w: 210, h: 170 },
    { id: 'family', x: 470, y: 440, w: 300, h: 120 },
  ];
  const P = { cx: 400, cy: 310, r: 106 };
  const wrap = (s: string) => {
    const w = s.split(' ');
    if (w.length < 2 || s.length <= 12) return [s];
    const m = Math.ceil(w.length / 2);
    return [w.slice(0, m).join(' '), w.slice(m).join(' ')];
  };
  const pick = (id: string) => (e: React.SyntheticEvent) => { e.preventDefault(); onPick(id); };
  const font = { fontFamily: "'Alexandria','Cairo',sans-serif" };
  return (
    <svg viewBox="0 0 800 620" className="w-full h-auto select-none" role="group" aria-label={isEn ? 'Concept masterplan' : 'مخطط تصوّري'}>
      <defs>
        <pattern id="ld-grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M26 0H0V26" fill="none" stroke="#FFFFFF" strokeOpacity="0.05" />
        </pattern>
        <filter id="ld-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18" /></filter>
      </defs>
      <rect width="800" height="620" rx="30" fill="#0D1430" />
      <rect width="800" height="620" rx="30" fill="url(#ld-grid)" />

      <g fill="none" strokeLinecap="round">
        {blocks.map(b => {
          const on = active === b.id;
          return (
            <line key={b.id} x1={P.cx} y1={P.cy} x2={b.x + b.w / 2} y2={b.y + b.h / 2}
              stroke={on ? by[b.id].hue : '#FFFFFF'} strokeOpacity={on ? 0.9 : 0.12} strokeWidth={on ? 6 : 10} strokeDasharray={on ? '2 12' : undefined} />
          );
        })}
        <line x1={P.cx} y1={P.cy} x2={400} y2={572} stroke="#F5C518" strokeOpacity="0.35" strokeWidth="10" />
      </g>

      {blocks.map(b => {
        const x = by[b.id];
        const on = active === b.id;
        return (
          <g key={b.id} role="button" tabIndex={0} aria-pressed={on} aria-label={label(x)}
            onClick={pick(b.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') pick(b.id)(e); }}
            className="cursor-pointer outline-none">
            {on && <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="24" fill={x.hue} opacity="0.55" filter="url(#ld-blur)" className="glow" />}
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="24" fill={on ? x.hue : '#FFFFFF'} fillOpacity={on ? 1 : 0.06}
              stroke={x.hue} strokeOpacity={on ? 1 : 0.5} strokeWidth="2" />
            <circle cx={b.x + b.w / 2} cy={b.y + 40} r="19" fill={on ? '#0A0F1E' : x.hue} />
            <text x={b.x + b.w / 2} y={b.y + 47} textAnchor="middle" fontSize="19" fontWeight="800" fill={on ? x.hue : '#0A0F1E'}>{x.n}</text>
            {wrap(label(x)).map((ln, i) => (
              <text key={i} x={b.x + b.w / 2} y={b.y + 92 + i * 30} textAnchor="middle" fontSize="23" fontWeight="800" fill={on ? '#0A0F1E' : '#FFFFFF'} style={font}>{ln}</text>
            ))}
          </g>
        );
      })}

      <g role="button" tabIndex={0} aria-pressed={active === 'plaza'} aria-label={label(by.plaza)}
        onClick={pick('plaza')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') pick('plaza')(e); }} className="cursor-pointer outline-none">
        <circle cx={P.cx} cy={P.cy} r={P.r + 22} fill="#F5C518" opacity={active === 'plaza' ? 0.45 : 0.12} filter="url(#ld-blur)" className="glow" />
        <circle cx={P.cx} cy={P.cy} r={P.r} fill={active === 'plaza' ? '#F5C518' : '#0A0F1E'} stroke="#F5C518" strokeWidth="2" />
        <circle cx={P.cx} cy={P.cy} r={P.r - 12} fill="none" stroke={active === 'plaza' ? '#0A0F1E' : '#F5C518'} strokeOpacity="0.4" strokeDasharray="3 7" />
        <text x={P.cx} y={P.cy - 30} textAnchor="middle" fontSize="18" fontWeight="800" fill={active === 'plaza' ? '#0A0F1E' : '#F5C518'}>6</text>
        <text x={P.cx} y={P.cy + 8} textAnchor="middle" fontSize="28" fontWeight="800" fill={active === 'plaza' ? '#0A0F1E' : '#FFFFFF'} style={font}>{isEn ? 'The Plaza' : 'الساحة'}</text>
        <text x={P.cx} y={P.cy + 38} textAnchor="middle" fontSize="16" fill={active === 'plaza' ? '#0A0F1E' : '#C9D0E0'}>{isEn ? 'Prayer · Café · Store' : 'المصلى · المقهى · المتجر'}</text>
      </g>

      <rect x="320" y="550" width="160" height="46" rx="23" fill="#F5C518" />
      <text x="400" y="580" textAnchor="middle" fontSize="19" fontWeight="800" fill="#0A0F1E" style={font}>{isEn ? 'The Gate' : 'البوابة'}</text>

      <g>
        <rect x="30" y="470" width="236" height="66" rx="16" fill="#FFFFFF" fillOpacity="0.06" stroke="#FFFFFF" strokeOpacity="0.15" />
        <text x="148" y="498" textAnchor="middle" fontSize="16" fontWeight="800" fill="#FFFFFF">{isEn ? 'Concept diagram' : 'مخطط تصوّري'}</text>
        <text x="148" y="520" textAnchor="middle" fontSize="13" fill="#A9B2C8">{isEn ? 'Not to scale · no site chosen' : 'ليس بمقياس رسم · لا موقع محدد'}</text>
      </g>
    </svg>
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
          {tx('في كل منطقة ما يناسب الأطفال، وما هو خاص بالرجال، وما هو خاص بالنساء، وما تعيشه الأسرة معاً — فيترك الأب ابنه في نشاط بإشراف، ويحضر هو ما يخصه، ثم تلتقي الأسرة.', 'Every district holds something for children, something for men only, something for women only, and something the family lives together — so a father leaves his son at a supervised activity, attends his own, and the family meets again.')}
        </p>
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap gap-2 mb-6">
        {WHO_ORDER.map(w => (
          <li key={w} className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold border border-[#0A0F1E]/5"><Dot w={w} size={10} />{isEn ? AUD[w].en : AUD[w].ar}</li>
        ))}
      </ul>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {JOURNEYS.map(j => (
          <div key={j.who.ar} className="rise rounded-[28px] bg-white p-5 sm:p-6 border border-[#0A0F1E]/5 relative overflow-hidden">
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
            {(['men', 'women', 'kids', 'kids'] as Who[]).map((w, i) => (
              <span key={i} className="w-9 h-9 rounded-full ring-2 ring-[#0A0F1E]" style={{ background: AUD[w].dot }} />
            ))}
          </span>
          <p className="disp text-2xl font-extrabold">{tx('ثم تلتقي الأسرة', 'Then the family meets')}</p>
        </div>
        <ol className="relative flex flex-wrap gap-2 lg:ms-auto">
          {[
            { ar: 'المصلى', en: 'Prayer' },
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
  const [active, setActive] = useState('plaza');
  const cur = DISTRICTS.find(d => d.id === active)!;

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

      {/* ── Hero ── */}
      <header className="relative min-h-[640px] h-[88svh] max-h-[920px] overflow-hidden bg-[#0A0F1E] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/land/store.webp" alt="" fetchPriority="high" className="kb absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/60 to-[#0A0F1E]/30" aria-hidden />
        {/* Darker on the side the words sit on. */}
        <div className={`absolute inset-0 ${isEn ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-[#0A0F1E]/75 via-[#0A0F1E]/20 to-transparent`} aria-hidden />
        <Concept isEn={isEn} />
        <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-8 flex flex-col justify-end pb-12 sm:pb-16">
          <span className="self-start glass rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold text-[#F5C518]">{tx('مشروع مستقبلي', 'A future project')}</span>
          <p className="serif mt-5 mb-3 sm:mb-5 text-2xl sm:text-3xl text-[#E8C873]" dir="ltr" style={{ textAlign: isEn ? 'left' : 'right' }}>Moslim Leader Land</p>
          <h1 className="disp font-black leading-[1.05] text-[52px] sm:text-[92px] lg:text-[116px]" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {tx('أرض القائد المسلم', 'The Land of the Muslim Leader')}
          </h1>
          <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-white/80">
            {tx('مكان كبير جداً للأسرة المسلمة، تتحوّل فيه قصص مسلم ليدر وقيمها إلى أماكن تُعاش — لكل فرد فيه مساره، وللأسرة لقاؤها. لا يكفي يوم واحد لتغطيته.', 'A very large place for the Muslim family, where Moslim Leader’s stories and values become places to live in — a path for each member, a meeting place for all. One day is not enough.')}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#plan" className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0A0F1E] font-black px-6 py-3.5 rounded-full hover:bg-white transition">
              {tx('استكشف المخطط', 'Explore the plan')} <Icon name="down" size={18} />
            </a>
            <Link href="/partnership#request" className="glass inline-flex items-center gap-2 text-white font-bold px-6 py-3.5 rounded-full hover:bg-white/20 transition">
              {tx('شارك في بنائها', 'Help build it')}
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-2xl">
            {[
              { k: tx('للأسرة', 'For'), v: tx('كلها', 'every family') },
              { k: tx('حول', 'Around'), v: tx('العالم', 'the world') },
              { k: tx('ست', 'Six'), v: tx('مناطق', 'districts') },
            ].map(s => (
              <div key={s.v} className="glass rounded-2xl px-3 sm:px-4 py-3">
                <dt className="text-[11px] sm:text-xs text-white/60">{s.k}</dt>
                <dd className="disp text-lg sm:text-2xl font-extrabold">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

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

      {/* ── Interactive masterplan ── */}
      <section id="plan" className="relative bg-[#0A0F1E] text-white scroll-mt-20 overflow-hidden">
        <div className="absolute -top-40 end-[-10%] w-[60%] aspect-square rounded-full bg-[#F5C518]/10 blur-3xl" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-20 sm:py-24">
          <p className="text-sm font-bold text-[#E8C873]">{tx('المخطط', 'The plan')}</p>
          <h2 className="disp mt-2 text-4xl sm:text-5xl font-extrabold leading-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>{tx('ست مناطق حول ساحة واحدة', 'Six districts around one plaza')}</h2>
          <p className="mt-3 max-w-xl text-white/65">{tx('ادخل من البوابة إلى الساحة، ثم اضغط أي منطقة لترى ما فيها لكل فرد من الأسرة.', 'Enter through the gate into the plaza, then tap any district to see what it holds for each member of the family.')}</p>

          <div className="mt-10 grid gap-6 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 rounded-[30px] ring-1 ring-white/10 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.45)] self-start">
              <Masterplan isEn={isEn} active={active} onPick={setActive} />
            </div>
            <aside className="lg:col-span-5 rounded-[30px] overflow-hidden bg-white/[0.04] ring-1 ring-white/10 flex flex-col" aria-live="polite">
              <div className="relative aspect-[16/9]">
                {cur.img ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img key={cur.img} src={cur.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <Concept isEn={isEn} />
                  </>
                ) : <Art d={cur} />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E] to-transparent" aria-hidden />
                <span className="absolute bottom-3 start-5 disp text-6xl font-black" style={{ color: cur.hue }}>{cur.n}</span>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <span className="self-start rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${cur.hue}22`, color: cur.hue }}>{L(cur.tag)}</span>
                <h3 className="disp mt-3 text-2xl sm:text-3xl font-extrabold leading-tight">{L(cur.title)}</h3>
                <p className="mt-3 text-white/70 leading-relaxed text-sm">{L(cur.intro)}</p>
                <div className="mt-5"><WhoGrid d={cur} isEn={isEn} /></div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {DISTRICTS.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setActive(d.id)}
                      aria-pressed={active === d.id}
                      aria-label={L(d.title)}
                      className={`w-10 h-10 rounded-full font-black tabular-nums transition ${active === d.id ? 'text-[#0A0F1E]' : 'bg-white/[0.06] text-white/70 hover:text-white'}`}
                      style={active === d.id ? { background: d.hue } : undefined}
                    >
                      {d.n}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── The districts ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20 sm:py-24">
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
