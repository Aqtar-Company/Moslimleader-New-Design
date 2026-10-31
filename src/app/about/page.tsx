'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import Icon, { type IconName } from '@/components/media/Icon';

/**
 * «من نحن» — in the brand system of public/brand-strategy.html (navy, gold, cream and the
 * eight-point star), with icons instead of emoji.
 *
 * The founder section and the sister organisations are taken from the founder's own site,
 * ibrahimhassan.net (academic posts, degrees, Islamic studies, books, ventures). Change
 * them there first, then here — this page must not claim more than that site does.
 * Logos and portrait: public/about/.
 */

const STAR = "url(\"data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23F5C518' stroke-opacity='0.09'%3E%3Cpath d='M36 6 L44 28 L66 36 L44 44 L36 66 L28 44 L6 36 L28 28 Z'/%3E%3C/g%3E%3C/svg%3E\")";
const STAR_CLIP = 'polygon(50% 0,61% 25%,85% 15%,75% 39%,100% 50%,75% 61%,85% 85%,61% 75%,50% 100%,39% 75%,15% 85%,25% 61%,0 50%,25% 39%,15% 15%,39% 25%)';

function StarIcon({ name, size = 'md' }: { name: IconName; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  return (
    <span className={`${box} shrink-0 inline-flex items-center justify-center bg-[#F5C518] text-[#0C1428]`} style={{ clipPath: STAR_CLIP }} aria-hidden>
      <Icon name={name} size={size === 'lg' ? 26 : 20} />
    </span>
  );
}

function SectionHead({ eyebrow, title, sub, light = false }: { eyebrow: string; title: string; sub?: string; light?: boolean }) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className={`text-sm font-bold mb-2 ${light ? 'text-[#FBEEBB]' : 'text-[#22335C]'}`}>{eyebrow}</p>
      <h2 className={`text-2xl sm:text-3xl font-black leading-snug ${light ? 'text-white' : 'text-[#0C1428]'}`} style={{ textWrap: 'balance' } as React.CSSProperties}>{title}</h2>
      {sub && <p className={`mt-3 leading-relaxed ${light ? 'text-[#D7DCE8]' : 'text-[#5C6373]'}`}>{sub}</p>}
    </div>
  );
}

export default function AboutPage() {
  const { t, isRtl, lang } = useLang();
  const isEn = lang === 'en';
  const tx = (ar: string, en: string) => (isEn ? en : ar);

  const pillars = [
    { titleKey: 'about.vision.title',  textKey: 'about.vision.text',  icon: 'eye' },
    { titleKey: 'about.mission.title', textKey: 'about.mission.text', icon: 'send' },
    { titleKey: 'about.goal.title',    textKey: 'about.goal.text',    icon: 'badge' },
  ] as const;

  const features = [
    { key: 'about.feat1', icon: 'image' },
    { key: 'about.feat2', icon: 'zap' },
    { key: 'about.feat3', icon: 'book' },
    { key: 'about.feat4', icon: 'grid' },
  ] as const;

  const products = [
    { titleKey: 'about.prod1.title', descKey: 'about.prod1.desc', icon: 'book' },
    { titleKey: 'about.prod2.title', descKey: 'about.prod2.desc', icon: 'heart' },
    { titleKey: 'about.prod3.title', descKey: 'about.prod3.desc', icon: 'grid' },
    { titleKey: 'about.prod4.title', descKey: 'about.prod4.desc', icon: 'moon' },
    { titleKey: 'about.prod5.title', descKey: 'about.prod5.desc', icon: 'edit' },
    { titleKey: 'about.prod6.title', descKey: 'about.prod6.desc', icon: 'tag' },
  ] as const;

  const values = [
    { titleKey: 'about.val1.title', descKey: 'about.val1.desc', icon: 'moon' },
    { titleKey: 'about.val2.title', descKey: 'about.val2.desc', icon: 'smile' },
    { titleKey: 'about.val3.title', descKey: 'about.val3.desc', icon: 'heart' },
  ] as const;

  const founderFacts: { icon: IconName; title: string; body: string }[] = [
    {
      icon: 'badge',
      title: tx('المسار الأكاديمي', 'Academic path'),
      body: tx(
        'أستاذ مشارك في قسم الإعلام الرقمي والاتصال بجامعة عفت في جدة، وفي قسم التصميمات بكلية الفنون الجميلة بجامعة الإسكندرية. دكتوراه الفلسفة في التصميم الجرافيكي من جامعة الإسكندرية.',
        'Associate Professor at the Department of Digital Media and Communication, Effat University (Jeddah), and at the Faculty of Fine Arts, Alexandria University. PhD in Graphic Design, Alexandria University.',
      ),
    },
    {
      icon: 'moon',
      title: tx('العلوم الشرعية', 'Islamic studies'),
      body: tx(
        'ماجستير الفقه وأصوله من جامعة منيسوتا الإسلامية (2025)، ويدرس الدكتوراه فيه. وحاصل على إجازة في قراءة عاصم بروايتي شعبة وحفص.',
        'MA in Fiqh and its Principles, Minnesota Islamic University (2025), now reading for the doctorate. Holds an ijazah in the recitation of ʿĀṣim, in the narrations of Shuʿbah and Ḥafṣ.',
      ),
    },
    {
      icon: 'zap',
      title: tx('بحث يخدم المحتوى', 'Research behind the content'),
      body: tx(
        'أبحاث محكّمة في توظيف الذكاء الاصطناعي لتصميم المحتوى التعليمي للأطفال المسلمين وترويجه، وفي أثر الوسائط الورقية والرقمية على قراءة القرآن.',
        'Peer-reviewed research on using AI to design and promote educational content for Muslim children, and on how print and digital media affect Quran reading.',
      ),
    },
    {
      icon: 'book',
      title: tx('المؤلفات', 'Books'),
      body: tx(
        'العقل الشجاع، فقيه في بلاد العجائب، البخاري على كوكب المريخ، رسائل أمهات العظماء، فلسطين في عيون أبنائي، وسلاسل: الصلاة، ومسلسل البر، وابني يسأل.',
        'The Brave Mind, An Islamic Jurist in Wonderland, Al-Bukhari on Mars Planet, Letters of the Mothers of the Great, Palestine in My Children\'s Eyes, and the story series on prayer, on righteousness to parents, and «My Child Asks».',
      ),
    },
    {
      icon: 'heart',
      title: tx('مشاريع قرآنية', 'Quran projects'),
      body: tx(
        'موقع لاستماع وتدبر القرآن، وتطبيق «صحف» للحفظ السماعي، ومشروع «ألواح» لحفظ القرآن لغير الناطقين بالعربية وللأطفال دون سن القراءة.',
        'A site for listening to and reflecting on the Quran, the «Suhuf» app for memorising by listening, and «Alwah» for memorisation by non-Arabic speakers and pre-reading children.',
      ),
    },
    {
      icon: 'check',
      title: tx('تقدير', 'Recognition'),
      body: tx(
        'حاصل على «إقامة موهبة» المميزة في المملكة العربية السعودية (2024) ضمن فئة الكفاءات الاستثنائية.',
        'Awarded the Saudi Premium Residency in the «Mawhiba» (exceptional talent) category, 2024.',
      ),
    },
  ];

  const partners = [
    { logo: '/about/partners/aqtar.webp', name: tx('أقطار', 'Aqtar'), field: tx('للتصميم والميديا', 'Design & Media'), url: 'https://aqtardesign.com', host: 'aqtardesign.com',
      desc: tx('استشارات الهوية البصرية والاتصال المؤسسي والوسائط.', 'Visual identity, corporate communication and media.') },
    { logo: '/about/partners/bravemind.webp', name: tx('العقل الشجاع', 'Brave Mind'), field: tx('للألعاب الرقمية', 'Digital Games'), url: 'https://bravemind.dev', host: 'bravemind.dev',
      desc: tx('تطوير الألعاب الرقمية التعليمية والتربوية.', 'Educational and character-building digital games.') },
    { logo: '/about/partners/qabed.webp', name: tx('قابض', 'Qabed'), field: tx('للأنظمة والبرمجيات', 'Systems & Software'), url: 'https://qabed.com', host: 'qabed.com',
      desc: tx('تطوير الأنظمة والبرمجيات للمؤسسات.', 'Systems and software for organisations.') },
    { logo: '/about/partners/kaleem.webp', name: tx('كليم', 'Kaleem'), field: tx('للسلامة النفسية', 'Mental Well-being'), url: 'https://kaleemai.com', host: 'kaleemai.com',
      desc: tx('منصة دعم نفسي مدعومة بالذكاء الاصطناعي، بمنظور يحترم القيم الإسلامية.', 'AI-supported psychological support, grounded in Islamic values.') },
    { logo: '/about/partners/waqf.webp', name: tx('وقف الأفكار', 'Waqf El Afkar'), field: tx('للوقف المعرفي', 'Knowledge Endowment'), url: 'https://waqfelafkar.com', host: 'waqfelafkar.com',
      desc: tx('منصة وقفية لدعم الأفكار والمشاريع المعرفية.', 'An endowment platform supporting ideas and knowledge projects.') },
  ];

  return (
    <div className="bg-[#FFFDF4] text-[#1C2430]" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Hero ── */}
      <header
        className="relative overflow-hidden text-white pt-32 pb-20"
        style={{ background: 'radial-gradient(1100px 520px at 85% -10%, rgba(245,197,24,.22), transparent 60%), linear-gradient(160deg, #0C1428 0%, #16223F 75%)' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: STAR }} aria-hidden />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block border border-[#F5C518]/50 text-[#F5C518] text-sm font-bold px-4 py-1 rounded-full mb-6">
            {t('about.title')}
          </span>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-4" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {t('about.brand.title')}
          </h1>
          <p className="text-[#D7DCE8] text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            {t('about.hero.text')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#founder" className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0C1428] font-black px-6 py-3 rounded-full hover:bg-yellow-300 transition">
              {tx('تعرّف على المؤسس', 'Meet the founder')}
            </a>
            <a href="#partners" className="inline-flex items-center gap-2 border border-white/40 text-white font-bold px-6 py-3 rounded-full hover:bg-white/10 transition">
              {tx('مؤسساتنا الشقيقة', 'Sister organisations')}
            </a>
          </div>
        </div>
      </header>

      {/* ── Vision / Mission / Goal ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pillars.map(p => (
            <div key={p.titleKey} className="bg-white border border-[#EFE7CE] rounded-2xl p-6 hover:border-[#F5C518] hover:-translate-y-1 hover:shadow-lg transition">
              <StarIcon name={p.icon} />
              <h3 className="font-black text-[#16223F] text-lg mt-4 mb-2">{t(p.titleKey)}</h3>
              <p className="text-[#3A4150] text-sm leading-relaxed">{t(p.textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Founder ── */}
      <section id="founder" className="bg-[#FAF6E6] py-16 scroll-mt-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 items-center mb-12">
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute inset-x-6 bottom-0 top-10 rounded-[2rem] bg-[#16223F]" style={{ backgroundImage: STAR }} aria-hidden />
              <div className="absolute -top-2 end-4 w-16 h-16 bg-[#F5C518]" style={{ clipPath: STAR_CLIP }} aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/about/founder.webp" alt={tx('د. إبراهيم حسن', 'Dr. Ibrahim Hassan')} width={600} height={688} className="relative w-full h-auto" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#22335C] mb-2">{tx('المؤسس', 'The founder')}</p>
              <h2 className="text-3xl sm:text-4xl font-black text-[#0C1428] leading-snug">{tx('د. إبراهيم حسن', 'Dr. Ibrahim Hassan')}</h2>
              <p className="mt-2 text-[#5C6373] font-semibold">
                {tx('مؤسس مسلم ليدر · أستاذ مشارك التصميم البصري والميديا الحديثة', 'Founder of Moslim Leader · Associate Professor of Visual Design and New Media')}
              </p>
              <blockquote className="mt-6 bg-white border border-[#EFE7CE] border-s-4 border-s-[#F5C518] rounded-e-2xl p-5 text-[#1C2430] leading-loose">
                {tx(
                  '«أؤمن أن نهضة الفرد والمجتمع تبدأ من مدى شعور الفرد بالمسؤولية… فالإنسان ينتهي به الأمر إلى أن يقف بين يدي الله يُسأَل عن كل ما مكّنه الله فيه، ويشمل ذلك علمه وماله وعمله. لا أفصل بين الدنيا والآخرة.»',
                  '“I believe the renewal of a person and of a society begins with how responsible a person feels… for in the end we stand before Allah and are asked about everything He enabled us in — our knowledge, our wealth and our work. I do not separate this world from the next.”',
                )}
              </blockquote>
              <p className="mt-5 text-[#3A4150] leading-relaxed">
                {tx(
                  'يجمع بين التربية والتصميم والإعلام والعلوم الشرعية، ومن هذا الجمع وُلدت مسلم ليدر: محتوى يقوم على الشريعة، ويُصمَّم بلغة بصرية معاصرة، ويُختبر بالبحث.',
                  'He brings together education, design, media and Islamic scholarship — and Moslim Leader grew out of that combination: content rooted in the Sharia, designed in a contemporary visual language, and tested by research.',
                )}
              </p>
              <a href="https://ibrahimhassan.net" target="_blank" rel="noopener" className="mt-6 inline-flex items-center gap-2 font-bold text-[#16223F] border-b-2 border-[#F5C518] pb-0.5 hover:text-[#22335C]">
                ibrahimhassan.net <Icon name="external" size={16} />
              </a>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {founderFacts.map(f => (
              <div key={f.title} className="bg-white border border-[#EFE7CE] rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-[#FAF6E6] text-[#22335C] flex items-center justify-center"><Icon name={f.icon} size={20} /></span>
                  <h3 className="font-black text-[#16223F]">{f.title}</h3>
                </div>
                <p className="text-sm text-[#3A4150] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sister organisations ── */}
      <section
        id="partners"
        className="relative overflow-hidden py-16 scroll-mt-24"
        style={{ background: 'radial-gradient(900px 420px at 15% 110%, rgba(245,197,24,.18), transparent 60%), linear-gradient(160deg, #16223F 0%, #0C1428 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: STAR }} aria-hidden />
        <div className="relative max-w-5xl mx-auto px-6">
          <SectionHead
            light
            eyebrow={tx('شركاؤنا', 'Our partners')}
            title={tx('مؤسسات شقيقة أسسها مؤسس مسلم ليدر', 'Sister organisations founded by Moslim Leader\'s founder')}
            sub={tx('كل واحدة منها تخدم جانبًا من الرسالة نفسها: التصميم، والألعاب، والبرمجيات، والسلامة النفسية، والوقف المعرفي.', 'Each one serves part of the same mission: design, games, software, mental well-being and knowledge endowment.')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {partners.map(p => (
              <a
                key={p.host}
                href={p.url}
                target="_blank"
                rel="noopener"
                className="group flex flex-col bg-white/[0.06] border border-white/15 rounded-2xl p-5 hover:border-[#F5C518] hover:bg-white/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5C518]"
              >
                <div className="h-24 flex items-center justify-center mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.logo} alt={p.name} loading="lazy" className="max-h-24 max-w-[140px] w-auto h-auto object-contain" />
                </div>
                <h3 className="font-black text-white text-lg leading-snug">{p.name} <span className="text-[#F5C518] text-sm font-bold block">{p.field}</span></h3>
                <p className="mt-2 text-sm text-[#C9CFDD] leading-relaxed flex-1">{p.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#FBEEBB]" dir="ltr">{p.host} <Icon name="external" size={13} /></span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── What makes us different ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <SectionHead eyebrow={tx('لماذا مسلم ليدر', 'Why Moslim Leader')} title={t('about.features.title')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(f => (
            <div key={f.key} className="bg-white border border-[#EFE7CE] rounded-2xl p-5 flex gap-4 items-start">
              <StarIcon name={f.icon} />
              <p className="text-[#3A4150] text-sm leading-relaxed">{t(f.key)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Values ── */}
      <section className="bg-[#FAF6E6] py-16">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHead eyebrow={tx('ما نؤمن به', 'What we believe')} title={isRtl ? 'قيمنا' : 'Our Values'} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {values.map(v => (
              <div key={v.titleKey} className="bg-white border border-[#EFE7CE] rounded-2xl p-6">
                <StarIcon name={v.icon} />
                <h3 className="font-black text-[#16223F] mt-4 mb-2">{t(v.titleKey)}</h3>
                <p className="text-[#3A4150] text-sm leading-relaxed">{t(v.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <SectionHead eyebrow={tx('ما نصنعه', 'What we make')} title={t('about.products.title')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.titleKey} className="bg-white border border-[#EFE7CE] rounded-2xl p-5 hover:border-[#F5C518] hover:-translate-y-1 hover:shadow-lg transition">
              <span className="w-11 h-11 rounded-xl bg-[#FAF6E6] text-[#22335C] flex items-center justify-center mb-3"><Icon name={p.icon} size={22} /></span>
              <h3 className="font-black text-[#16223F] mb-2">{t(p.titleKey)}</h3>
              <p className="text-[#5C6373] text-sm leading-relaxed">{t(p.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why tangible products ── */}
      <section className="relative overflow-hidden bg-[#16223F] py-14">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: STAR }} aria-hidden />
        <div className="relative max-w-5xl mx-auto px-6 flex flex-col md:flex-row gap-6 items-center">
          <StarIcon name="book" size="lg" />
          <div>
            <h2 className="text-xl font-black text-[#F5C518] mb-2">{t('about.tangible.title')}</h2>
            <p className="text-[#D7DCE8] leading-relaxed text-sm md:text-base">{t('about.tangible.text')}</p>
          </div>
        </div>
      </section>

      {/* ── Brand story ── */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="mx-auto mb-6 w-12 h-12 bg-[#F5C518]" style={{ clipPath: STAR_CLIP }} aria-hidden />
        <h2 className="text-2xl font-black text-[#0C1428] mb-4">{t('about.brand.title')}</h2>
        <p className="text-[#5C6373] leading-relaxed mb-8">{t('about.brand.text')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="inline-block bg-[#F5C518] text-[#0C1428] px-8 py-3 rounded-full font-black hover:bg-yellow-300 transition shadow-md">
            {t('about.cta')}
          </Link>
          <Link href="/partnership" className="inline-block border-2 border-[#16223F] text-[#16223F] px-8 py-3 rounded-full font-black hover:bg-[#16223F] hover:text-white transition">
            {tx('الشراكة معنا', 'Partner with us')}
          </Link>
        </div>
      </section>
    </div>
  );
}
