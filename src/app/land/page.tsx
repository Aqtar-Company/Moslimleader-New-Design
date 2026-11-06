'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import Icon, { type IconName } from '@/components/media/Icon';

/**
 * «أرض القائد المسلم» — Moslim Leader Land, the future plan as its own page, laid out as a
 * project: what it is, a masterplan of its districts, then one section per district.
 *
 * Every picture is a CONCEPT image and is labelled «تصوّر مبدئي» on the page itself (the
 * same rule as the partnership deck's Land section), and the map is a «مخطط تصوّري», not a
 * site plan: no scale, no area, no site. The text says only what the owner described — a
 * very large place for the whole Muslim family, in more than one country, too big for one
 * day: characters, cinema, a family forum, a fatwa and family-counselling centre, scouts,
 * play, a girls' and women's club, and rides and games on an Islamic concept with no
 * horror house and nothing that puts a life at risk. No figures, dates or locations: none
 * were given, and a plan must not read like a promise.
 *
 * Pictures live in public/land/ (new) and public/partnership/land-*.webp (shared with the
 * deck). A district without a picture yet shows its components only — add its image to
 * `img` when one is supplied.
 *
 * Brand system: the About page's (navy, gold, cream, the eight-point star).
 */

const STAR = "url(\"data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23F5C518' stroke-opacity='0.09'%3E%3Cpath d='M36 6 L44 28 L66 36 L44 44 L36 66 L28 44 L6 36 L28 28 Z'/%3E%3C/g%3E%3C/svg%3E\")";
const STAR_CLIP = 'polygon(50% 0,61% 25%,85% 15%,75% 39%,100% 50%,75% 61%,85% 85%,61% 75%,50% 100%,39% 75%,15% 85%,25% 61%,0 50%,25% 39%,15% 15%,39% 25%)';
const DISPLAY = { fontFamily: "'Noto Kufi Arabic', 'Cairo', sans-serif" } as const;

type L = { ar: string; en: string };
type District = {
  id: string;
  n: number;
  icon: IconName;
  /** Map tint. */
  tint: string;
  title: L;
  tag: L;
  intro: L;
  parts: L[];
  img?: { src: string; alt: L }[];
};

const DISTRICTS: District[] = [
  {
    id: 'stories', n: 1, icon: 'book', tint: '#F6E7B8',
    title: { ar: 'عالم الحكايات والسينما', en: 'Stories & Cinema' },
    tag: { ar: 'من الرواية إلى التجربة', en: 'From the novel to the experience' },
    intro: {
      ar: 'هنا تخرج قصص مسلم ليدر من الكتاب: أفلام مأخوذة من رواياتها على الشاشة الكبيرة، وقاعة مغامرات يدخل فيها الطفل إلى عالم القصة، وشخصيات مسلم ليدر يلتقيها ويتصوّر معها.',
      en: 'Here Moslim Leader’s stories leave the book: films made from its novels on the big screen, an adventure hall that takes a child inside the story, and the characters themselves to meet.',
    },
    parts: [
      { ar: 'سينما أفلام وروايات مسلم ليدر', en: 'A cinema for Moslim Leader films and novels' },
      { ar: 'قاعة مغامرات الحكاية', en: 'The Story Adventure Hall' },
      { ar: 'لقاء شخصيات مسلم ليدر', en: 'Meeting the Moslim Leader characters' },
      { ar: 'ركن الحكي والقراءة', en: 'Storytelling and reading corner' },
    ],
    img: [
      { src: '/partnership/land-stories.webp', alt: { ar: 'تصوّر لعالم الروايات التفاعلي', en: 'Concept: the interactive story world' } },
    ],
  },
  {
    id: 'games', n: 2, icon: 'zap', tint: '#DDEBF0',
    title: { ar: 'الألعاب والملاهي', en: 'Games & Rides' },
    tag: { ar: 'ترفيه يحترم الهوية', en: 'Fun that respects identity' },
    intro: {
      ar: 'ملاهٍ وألعاب فيديو بمفهوم إسلامي، وألعاب بطلها شخصيات مسلم ليدر — يكسب فيها الطفل بالمساعدة والقراءة والعمل الطيب. ألعاب إسلامية راقية تحترم الهوية والفكر والفلسفة الإسلامية.',
      en: 'Rides and video games on an Islamic concept, and games whose heroes are the Moslim Leader characters — where a child scores by helping, reading and doing good. Refined Islamic games that respect identity, thought and outlook.',
    },
    parts: [
      { ar: 'ألعاب فيديو بشخصيات مسلم ليدر', en: 'Video games with the Moslim Leader characters' },
      { ar: 'ملاهٍ بمفهوم إسلامي', en: 'Rides on an Islamic concept' },
      { ar: 'أماكن لعب لكل الأعمار', en: 'Play areas for every age' },
      { ar: 'لا بيت رعب، ولا لعبة تعرّض حياة أحد للخطر', en: 'No horror house, no ride that puts a life at risk' },
    ],
  },
  {
    id: 'scouts', n: 3, icon: 'badge', tint: '#E3E8D5',
    title: { ar: 'الكشافة والمغامرة', en: 'Scouts & Adventure' },
    tag: { ar: 'شخصية قوية وغد أفضل', en: 'Strong character, brighter tomorrow' },
    intro: {
      ar: 'ركن كشافة للأولاد: حبال وعُقد، وجدار تسلّق، وجسور معلّقة، وتخييم بإشراف قادة — مغامرة تبني الشجاعة والانضباط وروح الفريق. وعلى بابه صالون للأولاد بهوية مسلم ليدر.',
      en: 'A scouts corner for boys: ropes and knots, a climbing wall, rope bridges and camping under trained leaders — adventure that builds courage, discipline and team spirit. At its door, a boys’ salon in the Moslim Leader identity.',
    },
    parts: [
      { ar: 'جدار تسلّق وجسور حبال', en: 'Climbing wall and rope bridges' },
      { ar: 'تخييم ومهارات الكشافة', en: 'Camping and scouting skills' },
      { ar: 'قادة ومشرفون مدرَّبون', en: 'Trained leaders' },
      { ar: 'صالون الأولاد', en: 'The boys’ salon' },
    ],
    img: [
      { src: '/land/scouts-climbing.webp', alt: { ar: 'تصوّر لجدار التسلّق في ركن الكشافة', en: 'Concept: the scouts climbing wall' } },
      { src: '/land/youth-salon.webp', alt: { ar: 'تصوّر لصالون الأولاد وبوابة ركن الكشافة', en: 'Concept: the boys’ salon at the scouts corner' } },
    ],
  },
  {
    id: 'girls', n: 4, icon: 'heart', tint: '#F6DDE4',
    title: { ar: 'نادي البنات والسيدات', en: 'Girls’ & Women’s Club' },
    tag: { ar: 'خصوصية وعافية ومجتمع', en: 'Privacy, wellbeing, community' },
    intro: {
      ar: 'مساحة خاصة بالبنات والسيدات تحفظ خصوصيتهن: رياضة وعافية، وجلسات حكي مع شخصيات مسلم ليدر، ورسم وأشغال، ولقاءات تجمع الأمهات.',
      en: 'A space of the girls’ and women’s own, private by design: sport and wellbeing, storytelling with the Moslim Leader characters, drawing and crafts, and gatherings for mothers.',
    },
    parts: [
      { ar: 'رياضة وعافية بخصوصية كاملة', en: 'Sport and wellbeing, fully private' },
      { ar: 'ركن «حكاية تصنع أثراً»', en: 'The “A story that leaves a mark” corner' },
      { ar: 'رسم وأشغال يدوية', en: 'Drawing and crafts' },
      { ar: 'لقاءات الأمهات', en: 'Mothers’ gatherings' },
    ],
    img: [
      { src: '/land/girls-stories.webp', alt: { ar: 'تصوّر لركن الحكايات للبنات', en: 'Concept: the girls’ story corner' } },
    ],
  },
  {
    id: 'family', n: 5, icon: 'comment', tint: '#E6E0F0',
    title: { ar: 'الأسرة والفكر', en: 'Family & Thought' },
    tag: { ar: 'نبني أسرة واعية', en: 'Building a mindful family' },
    intro: {
      ar: 'ما يعين الأب والأم: ملتقى ثقافي وفكري عن الأسرة ودعمها، وورش يتعلّم فيها الآباء والأبناء معاً الإنصات والتعاون واللطف، ومركز للفتوى والإرشاد الأسري يعين الزوجين على حل خلافاتهما.',
      en: 'What supports a father and a mother: a cultural and intellectual forum about the family, workshops where parents and children learn listening, cooperation and kindness together, and a fatwa and family-counselling centre that helps couples resolve their disputes.',
    },
    parts: [
      { ar: 'الملتقى الثقافي والفكري', en: 'The cultural and intellectual forum' },
      { ar: 'ورش الآباء والأبناء', en: 'Parent-and-child workshops' },
      { ar: 'مركز الفتوى', en: 'The fatwa centre' },
      { ar: 'الإرشاد في الخلافات الزوجية', en: 'Counselling for marital disputes' },
    ],
  },
  {
    id: 'plaza', n: 6, icon: 'moon', tint: '#FBEFC9',
    title: { ar: 'الساحة: المصلى والمقهى والمتجر', en: 'The Plaza: Prayer, Café, Store' },
    tag: { ar: 'قلب المكان', en: 'The heart of the place' },
    intro: {
      ar: 'في المنتصف تلتقي الطرق: المصلى في قلب التجربة لا على هامشها، ومقهى العائلة للاستراحة بين نشاط وآخر — فاليوم هنا طويل — ومتجر مسلم ليدر ليحمل الطفل الحكاية معه إلى البيت. وعند البوابة يبدأ الطفل رحلته بجواز يُختم في كل منطقة.',
      en: 'In the middle the paths meet: prayer at the heart of the experience, not its edge; the family café for a pause between activities — the day here is long; and the Moslim Leader store, so a child takes the story home. At the gate a child starts the journey with a passport stamped in every district.',
    },
    parts: [
      { ar: 'المصلى', en: 'The prayer hall' },
      { ar: 'مقهى العائلة', en: 'The family café' },
      { ar: 'متجر مسلم ليدر', en: 'The Moslim Leader store' },
      { ar: 'البوابة وجواز الرحلة', en: 'The gate and the journey passport' },
    ],
    img: [
      { src: '/partnership/land-prayer.webp', alt: { ar: 'تصوّر للمصلى', en: 'Concept: the prayer hall' } },
      { src: '/partnership/land-cafe.webp', alt: { ar: 'تصوّر لمقهى العائلة', en: 'Concept: the family café' } },
    ],
  },
];

function StarIcon({ name }: { name: IconName }) {
  return (
    <span className="w-12 h-12 shrink-0 inline-flex items-center justify-center bg-[#F5C518] text-[#0C1428]" style={{ clipPath: STAR_CLIP }} aria-hidden>
      <Icon name={name} size={20} />
    </span>
  );
}

function ConceptTag({ isEn }: { isEn: boolean }) {
  return (
    <span className="absolute top-3 start-3 z-10 rounded-full bg-black/55 backdrop-blur px-3 py-1 text-[11px] font-bold text-white/90">
      {isEn ? 'Concept visual' : 'تصوّر مبدئي'}
    </span>
  );
}

/**
 * The masterplan: six districts around a central plaza, the gate at the bottom. A diagram
 * of how the place is ORGANISED, not where anything stands — it says so under it. Each
 * block is a link to its section.
 */
function Masterplan({ isEn }: { isEn: boolean }) {
  const d = Object.fromEntries(DISTRICTS.map(x => [x.id, x]));
  const label = (x: District) => (isEn ? x.title.en : x.title.ar);
  // Blocks around the plaza (viewBox 800 × 620). Right-hand side first: the page reads RTL.
  const blocks: { id: string; x: number; y: number; w: number; h: number }[] = [
    { id: 'stories', x: 470, y: 30, w: 300, h: 150 },
    { id: 'games', x: 30, y: 30, w: 300, h: 150 },
    { id: 'girls', x: 560, y: 225, w: 210, h: 170 },
    { id: 'scouts', x: 30, y: 225, w: 210, h: 170 },
    { id: 'family', x: 470, y: 440, w: 300, h: 120 },
  ];
  const plaza = { cx: 400, cy: 310, r: 108 };
  const wrap = (s: string) => {
    // Two lines at most, split at the middle space, so a long name fits its block.
    const words = s.split(' ');
    if (words.length < 2 || s.length <= 12) return [s];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  };
  return (
    <svg viewBox="0 0 800 620" className="w-full h-auto" role="img" aria-label={isEn ? 'Concept masterplan of Moslim Leader Land' : 'مخطط تصوّري لأرض القائد المسلم'}>
      <defs>
        <pattern id="land-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="#0C1428" strokeOpacity="0.06" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="800" height="620" rx="28" fill="#FBF8F0" />
      <rect x="0" y="0" width="800" height="620" rx="28" fill="url(#land-grid)" />

      {/* Paths from the plaza to every district and to the gate */}
      <g stroke="#C9B98C" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.55">
        {blocks.map(b => (
          <line key={b.id} x1={plaza.cx} y1={plaza.cy} x2={b.x + b.w / 2} y2={b.y + b.h / 2} />
        ))}
        <line x1={plaza.cx} y1={plaza.cy} x2={400} y2={575} />
      </g>

      {blocks.map(b => {
        const x = d[b.id] as District;
        const lines = wrap(label(x));
        return (
          <a key={b.id} href={`#d-${x.id}`} aria-label={label(x)}>
            <g className="cursor-pointer [&:hover_rect]:stroke-[#F5C518]">
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="22" fill={x.tint} stroke="#0C1428" strokeOpacity="0.12" strokeWidth="2" />
              <circle cx={b.x + b.w / 2} cy={b.y + 40} r="20" fill="#0C1428" />
              <text x={b.x + b.w / 2} y={b.y + 47} textAnchor="middle" fontSize="20" fontWeight="800" fill="#F5C518">{x.n}</text>
              {lines.map((ln, i) => (
                <text key={i} x={b.x + b.w / 2} y={b.y + 92 + i * 30} textAnchor="middle" fontSize="23" fontWeight="800" fill="#0C1428" style={DISPLAY}>{ln}</text>
              ))}
            </g>
          </a>
        );
      })}

      {/* The plaza */}
      <a href={`#d-${DISTRICTS[5].id}`} aria-label={label(DISTRICTS[5])}>
        <g className="cursor-pointer">
          <circle cx={plaza.cx} cy={plaza.cy} r={plaza.r} fill="#0C1428" />
          <circle cx={plaza.cx} cy={plaza.cy} r={plaza.r - 10} fill="none" stroke="#F5C518" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="4 6" />
          <circle cx={plaza.cx} cy={plaza.cy - 48} r="19" fill="#F5C518" />
          <text x={plaza.cx} y={plaza.cy - 41} textAnchor="middle" fontSize="19" fontWeight="800" fill="#0C1428">6</text>
          <text x={plaza.cx} y={plaza.cy + 4} textAnchor="middle" fontSize="26" fontWeight="800" fill="#FFFFFF" style={DISPLAY}>{isEn ? 'The Plaza' : 'الساحة'}</text>
          <text x={plaza.cx} y={plaza.cy + 36} textAnchor="middle" fontSize="17" fill="#D7DCE8">{isEn ? 'Prayer · Café · Store' : 'المصلى · المقهى · المتجر'}</text>
        </g>
      </a>

      {/* The gate */}
      <g>
        <rect x="320" y="548" width="160" height="50" rx="25" fill="#F5C518" />
        <text x="400" y="580" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0C1428" style={DISPLAY}>{isEn ? 'The Gate' : 'البوابة'}</text>
      </g>

      {/* Bottom-left: a reminder that this is a diagram, not a site plan */}
      <g>
        <rect x="30" y="470" width="240" height="70" rx="16" fill="#FFFFFF" stroke="#0C1428" strokeOpacity="0.1" />
        <text x="150" y="500" textAnchor="middle" fontSize="17" fontWeight="800" fill="#0C1428">{isEn ? 'Concept diagram' : 'مخطط تصوّري'}</text>
        <text x="150" y="524" textAnchor="middle" fontSize="14" fill="#5C6373">{isEn ? 'Not to scale · no site chosen' : 'ليس بمقياس رسم · لا موقع محدد'}</text>
      </g>
    </svg>
  );
}

export default function LandPage() {
  const { lang } = useLang();
  const isEn = lang === 'en';
  const tx = (ar: string, en: string) => (isEn ? en : ar);
  const L = (l: L) => (isEn ? l.en : l.ar);

  const facts: { icon: IconName; t: L; s: L }[] = [
    { icon: 'heart', t: { ar: 'للأسرة كلها', en: 'For the whole family' }, s: { ar: 'الأب والأم والأولاد والبنات — لكلٍّ مكانه.', en: 'Father, mother, sons and daughters — a place for each.' } },
    { icon: 'link', t: { ar: 'في أكثر من مكان في العالم', en: 'In more than one country' }, s: { ar: 'نموذج يُبنى ليتكرر حيث تكون الأسرة المسلمة.', en: 'A model designed to be built again wherever Muslim families live.' } },
    { icon: 'moon', t: { ar: 'يوم واحد لا يكفي', en: 'One day is not enough' }, s: { ar: 'ست مناطق في مكان كبير جداً، يُزار أكثر من مرة.', en: 'Six districts in a very large place, made to be visited again.' } },
  ];

  return (
    <div className="bg-[#FAF8F3] text-[#0C1428]" dir={isEn ? 'ltr' : 'rtl'}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@700;800;900&display=swap" />

      {/* ── 1. The idea ── */}
      <header className="relative bg-[#0C1428] text-white pt-28 sm:pt-32 pb-40 sm:pb-52 overflow-hidden" style={{ backgroundImage: STAR }}>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <span className="inline-flex items-center gap-2 border border-[#F5C518]/50 text-[#F5C518] text-xs sm:text-sm font-bold px-4 py-1 rounded-full mb-5">
            {tx('مشروع مستقبلي · تصوّر مبدئي', 'A future project · Concept')}
          </span>
          <h1 className="text-4xl sm:text-6xl font-black leading-[1.15]" style={{ ...DISPLAY, textWrap: 'balance' } as React.CSSProperties}>
            {tx('أرض القائد المسلم', 'Moslim Leader Land')}
          </h1>
          <p className="mt-2 text-lg sm:text-2xl font-bold text-[#F5C518]">{isEn ? 'أرض القائد المسلم' : 'Moslim Leader Land'}</p>
          <p className="mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-[#D7DCE8]">
            {tx(
              'مكان كبير جداً للأسرة المسلمة، تتحوّل فيه قصص مسلم ليدر وقيمها إلى أماكن يعيشها الطفل وأسرته: سينما وحكايات، وألعاب وملاهٍ تحترم الهوية، وكشافة ومغامرة، ونادٍ للبنات والسيدات، وملتقى للأسرة ومركز للفتوى والإرشاد. مكان لا يكفي يوم واحد لتغطيته.',
              'A very large place for the Muslim family, where Moslim Leader’s stories and values become places a child and family live in: cinema and stories, games and rides that respect identity, scouts and adventure, a girls’ and women’s club, and a family forum with fatwa and counselling. Too big to cover in one day.',
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#plan" className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0C1428] font-black px-6 py-3 rounded-full hover:bg-yellow-300 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {tx('شاهد المخطط', 'See the plan')} <Icon name="down" size={18} />
            </a>
            <Link href="/partnership#request" className="inline-flex items-center gap-2 border border-white/40 text-white font-bold px-6 py-3 rounded-full hover:bg-white/10 transition">
              {tx('شارك في بنائها', 'Help build it')}
            </Link>
          </div>
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 -mt-32 sm:-mt-44">
        <figure className="relative rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(12,20,40,0.35)] ring-1 ring-black/5 bg-[#0C1428]">
          <ConceptTag isEn={isEn} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/land/store.webp" alt={tx('تصوّر لمتجر مسلم ليدر داخل أرض القائد المسلم', 'Concept: the Moslim Leader store inside the Land')} width={1600} height={900} fetchPriority="high" className="w-full h-auto block" />
        </figure>
      </div>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {facts.map(f => (
            <div key={f.t.ar} className="flex gap-4 items-start bg-white rounded-2xl p-5 border border-[#0C1428]/5">
              <StarIcon name={f.icon} />
              <div>
                <h2 className="font-black text-lg leading-snug" style={DISPLAY}>{L(f.t)}</h2>
                <p className="mt-1 text-sm text-[#5C6373] leading-relaxed">{L(f.s)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── The principles every activity rests on (the owner's «بصائر») ── */}
      <section className="bg-[#0C1428] text-white py-16 sm:py-20" style={{ backgroundImage: STAR }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-bold mb-2 text-[#FBEEBB]">{tx('البصائر', 'The principles')}</p>
            <h2 className="text-3xl sm:text-4xl font-black leading-snug" style={{ ...DISPLAY, textWrap: 'balance' } as React.CSSProperties}>
              {tx('فلسفة واحدة في كل نشاط', 'One philosophy in every activity')}
            </h2>
            <p className="mt-3 text-[#D7DCE8] leading-relaxed">
              {tx('من السينما إلى الملاهي ومن الكشافة إلى المقهى، كل ما في أرض القائد المسلم يقوم على البصائر نفسها.', 'From the cinema to the rides, from the scouts to the café, everything in the Land rests on the same principles.')}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { icon: 'badge', t: { ar: 'الإحسان', en: 'Ihsan — excellence' }, s: { ar: 'إتقان العمل ومعاملة الناس بأحسن ما يكون.', en: 'Doing things well, and treating people at our best.' } },
              { icon: 'check', t: { ar: 'الاقتصاد وعدم التبذير', en: 'Moderation, no waste' }, s: { ar: 'متعة لا تقوم على الإسراف، ولا تعلّم الطفل الاستهلاك.', en: 'Joy that does not rest on excess, nor teach a child to consume.' } },
              { icon: 'info', t: { ar: 'احترام العقل', en: 'Respect for the mind' }, s: { ar: 'نشاط يفتح باب السؤال والفهم، لا يستخفّ بالطفل.', en: 'Activities that invite questions and understanding, never talking down.' } },
              { icon: 'heart', t: { ar: 'روابط الأسرة', en: 'Family bonds' }, s: { ar: 'أنشطة تُعاش معاً، تقرّب الأب والأم من أبنائهما.', en: 'Activities lived together, bringing parents closer to their children.' } },
            ] as { icon: IconName; t: L; s: L }[]).map(p => (
              <div key={p.t.ar} className="rounded-2xl bg-white/[0.06] border border-white/10 p-5">
                <StarIcon name={p.icon} />
                <h3 className="mt-4 font-black text-xl leading-snug" style={DISPLAY}>{L(p.t)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#D7DCE8]">{L(p.s)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-[#F5C518]/30 bg-[#F5C518]/[0.07] p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="shrink-0 font-black text-[#F5C518]">{tx('لا مكان هنا لـ', 'No place here for')}</span>
            <ul className="flex flex-wrap gap-2">
              {[
                { ar: 'الفردية والأنانية', en: 'Individualism and selfishness' },
                { ar: 'الممارسات الإدمانية', en: 'Addictive practices' },
                { ar: 'الخوف والخطر كمتعة', en: 'Fear and danger as fun' },
              ].map(r => (
                <li key={r.ar} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">
                  <Icon name="close" size={14} className="text-[#F5A5A5]" /> {L(r)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 2. The plan ── */}
      <section id="plan" className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16 scroll-mt-24">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold mb-2 text-[#22335C]">{tx('المخطط', 'The plan')}</p>
          <h2 className="text-3xl sm:text-4xl font-black leading-snug" style={{ ...DISPLAY, textWrap: 'balance' } as React.CSSProperties}>
            {tx('ست مناطق حول ساحة واحدة', 'Six districts around one plaza')}
          </h2>
          <p className="mt-3 text-[#5C6373] leading-relaxed">
            {tx('تدخل الأسرة من البوابة إلى الساحة، ومنها إلى كل منطقة. اضغط أي منطقة لتنتقل إليها.', 'The family enters through the gate into the plaza, and from there to every district. Tap a district to go to it.')}
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-8 rounded-[28px] shadow-[0_12px_32px_rgba(12,20,40,0.10)] ring-1 ring-[#0C1428]/5 overflow-hidden">
            <Masterplan isEn={isEn} />
          </div>
          <ol className="lg:col-span-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {DISTRICTS.map(x => (
              <li key={x.id}>
                <a href={`#d-${x.id}`} className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-[#0C1428]/5 hover:border-[#F5C518] transition">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-[#0C1428] text-[#F5C518] font-black flex items-center justify-center tabular-nums">{x.n}</span>
                  <span className="min-w-0">
                    <span className="block font-black leading-snug">{L(x.title)}</span>
                    <span className="block text-xs text-[#5C6373] truncate">{L(x.tag)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 3. The districts ── */}
      {DISTRICTS.map((x, i) => {
        const dark = i % 2 === 1;
        const imgs = x.img ?? [];
        return (
          <section
            key={x.id}
            id={`d-${x.id}`}
            className={`scroll-mt-24 py-16 sm:py-20 ${dark ? 'bg-[#0C1428] text-white' : ''}`}
            style={dark ? { backgroundImage: STAR } : undefined}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="grid gap-8 lg:grid-cols-12 items-start">
                <div className="lg:col-span-5">
                  <div className="flex items-center gap-3">
                    <span className={`w-12 h-12 rounded-full font-black text-xl flex items-center justify-center tabular-nums ${dark ? 'bg-[#F5C518] text-[#0C1428]' : 'bg-[#0C1428] text-[#F5C518]'}`}>{x.n}</span>
                    <span className={`text-xs font-bold rounded-full px-3 py-1 border ${dark ? 'border-[#F5C518]/50 text-[#F5C518]' : 'bg-[#FFF3C4] border-[#F5C518] text-[#0C1428]'}`}>{L(x.tag)}</span>
                  </div>
                  <h2 className="mt-4 text-3xl sm:text-4xl font-black leading-snug" style={{ ...DISPLAY, textWrap: 'balance' } as React.CSSProperties}>{L(x.title)}</h2>
                  <p className={`mt-4 leading-loose ${dark ? 'text-[#D7DCE8]' : 'text-[#5C6373]'}`}>{L(x.intro)}</p>
                  <ul className="mt-6 grid gap-2">
                    {x.parts.map(p => (
                      <li key={p.ar} className="flex items-start gap-2.5">
                        <span className={`mt-1 shrink-0 w-5 h-5 rounded-full inline-flex items-center justify-center ${dark ? 'bg-[#F5C518]/20 text-[#F5C518]' : 'bg-[#0C1428] text-[#F5C518]'}`} aria-hidden><Icon name="check" size={12} /></span>
                        <span className="font-bold leading-snug">{L(p)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lg:col-span-7">
                  {imgs.length > 0 ? (
                    <div className={`grid gap-3 ${imgs.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                      {imgs.map((im, k) => (
                        <figure
                          key={im.src}
                          className={`relative rounded-3xl overflow-hidden bg-[#0C1428] shadow-[0_12px_32px_rgba(12,20,40,0.18)] ${imgs.length === 3 && k === 0 ? 'sm:col-span-2' : ''}`}
                        >
                          <ConceptTag isEn={isEn} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={im.src} alt={L(im.alt)} width={1600} height={900} loading="lazy" className="w-full h-auto block" />
                        </figure>
                      ))}
                    </div>
                  ) : (
                    // No picture yet: the district's own mark, large, so the section still
                    // has a visual weight equal to its neighbours.
                    <div className={`aspect-[16/9] rounded-3xl flex flex-col items-center justify-center gap-4 text-center p-6 ${dark ? 'bg-white/[0.06] border border-white/10' : 'bg-white border border-[#0C1428]/5'}`} style={{ backgroundImage: STAR }}>
                      <span className="w-20 h-20 inline-flex items-center justify-center bg-[#F5C518] text-[#0C1428]" style={{ clipPath: STAR_CLIP }} aria-hidden>
                        <Icon name={x.icon} size={34} />
                      </span>
                      <p className={`text-sm font-bold ${dark ? 'text-[#D7DCE8]' : 'text-[#5C6373]'}`}>{tx('تصوّر المنطقة قيد الإعداد', 'Concept visual in preparation')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── 4. Build it with us ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="rounded-3xl bg-[#F5C518] text-[#0C1428] p-7 sm:p-10 flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-black leading-snug" style={DISPLAY}>{tx('أرض القائد المسلم تُبنى مع شركاء', 'The Land is built with partners')}</h2>
            <p className="mt-2 leading-relaxed text-[#0C1428]/80">
              {tx(
                'هذا مشروع مستقبلي وتصوّر مبدئي، يتطوّر مع الشركاء ودراسة كل موقع. إن كنت مستثمراً أو مشغّلاً أو جهة تؤمن بالفكرة، فمكانك معنا.',
                'This is a future project and an early concept that grows with partners and the study of each site. If you are an investor, an operator or an organisation that believes in it, there is a place for you.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link href="/partnership#request" className="inline-flex items-center justify-center gap-2 bg-[#0C1428] text-[#F5C518] font-black px-7 py-3.5 rounded-full hover:bg-[#16223F] transition">
              {tx('قدّم طلب الشراكة', 'Apply to partner')}
            </Link>
            <Link href="/partnership#land" className="inline-flex items-center justify-center gap-2 border-2 border-[#0C1428] text-[#0C1428] font-black px-6 py-3 rounded-full hover:bg-[#0C1428] hover:text-[#F5C518] transition">
              {tx('في التصور الاستراتيجي', 'In the strategy deck')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
