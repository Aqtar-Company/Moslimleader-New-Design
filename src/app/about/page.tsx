'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';

const CATALOG_PREVIEW  = 'https://drive.google.com/file/d/17LSwyrbq01E3D1ST2QDDqqJsSqSI4ofw/preview';
const CATALOG_DOWNLOAD = 'https://drive.google.com/uc?export=download&id=17LSwyrbq01E3D1ST2QDDqqJsSqSI4ofw';

/* ── 3D Icon Box ───────────────────────────────────────────── */
function Icon3D({ emoji, from, to }: { emoji: string; from: string; to: string }) {
  return (
    <div
      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${from} ${to} flex items-center justify-center text-3xl
        shadow-[4px_4px_0px_0px_rgba(0,0,0,0.18)] shrink-0`}
    >
      {emoji}
    </div>
  );
}

export default function AboutPage() {
  const { t, isRtl } = useLang();
  const dir = isRtl ? 'rtl' : 'ltr';

  const cards = [
    {
      emoji: '🔭',
      from: 'from-violet-400', to: 'to-indigo-600',
      title: t('about.vision.title'),
      text:  t('about.vision.text'),
    },
    {
      emoji: '📜',
      from: 'from-amber-300', to: 'to-orange-500',
      title: t('about.mission.title'),
      text:  t('about.mission.text'),
    },
    {
      emoji: '🎯',
      from: 'from-emerald-300', to: 'to-teal-600',
      title: t('about.goal.title'),
      text:  t('about.goal.text'),
    },
  ];

  const values = [
    {
      emoji: '📖',
      from: 'from-yellow-300', to: 'to-amber-500',
      title: t('about.val1.title'),
      desc:  t('about.val1.desc'),
    },
    {
      emoji: '🎮',
      from: 'from-pink-400',   to: 'to-rose-600',
      title: t('about.val2.title'),
      desc:  t('about.val2.desc'),
    },
    {
      emoji: '👨‍👩‍👧‍👦',
      from: 'from-sky-400',    to: 'to-blue-600',
      title: t('about.val3.title'),
      desc:  t('about.val3.desc'),
    },
  ];

  const features = [
    { emoji: '🎨', from: 'from-fuchsia-400', to: 'to-purple-600', text: t('about.feat1') },
    { emoji: '📱', from: 'from-cyan-400',    to: 'to-blue-600',   text: t('about.feat2') },
    { emoji: '⚖️', from: 'from-lime-400',    to: 'to-green-600',  text: t('about.feat3') },
    { emoji: '🌐', from: 'from-amber-400',   to: 'to-orange-600', text: t('about.feat4') },
  ];

  const products = [
    { img: '/icons/icon-books.png',      title: t('about.prod1.title'), desc: t('about.prod1.desc') },
    { img: '/icons/icon-stories.png',    title: t('about.prod2.title'), desc: t('about.prod2.desc') },
    { img: '/icons/icon-games.png',      title: t('about.prod3.title'), desc: t('about.prod3.desc') },
    { img: '/icons/icon-quran.png',      title: t('about.prod4.title'), desc: t('about.prod4.desc') },
    { img: '/icons/icon-stationery.png', title: t('about.prod5.title'), desc: t('about.prod5.desc') },
  ];

  return (
    <div dir={dir} className="overflow-x-hidden">

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section className="relative w-full overflow-hidden mt-16">
        <Image
          src="/about-hero-portrait.jpg"
          alt={t('about.title')}
          width={1080} height={1350}
          className="block md:hidden w-full h-auto object-cover"
          priority unoptimized
        />
        <Image
          src="/about-hero-landscape.jpg"
          alt={t('about.title')}
          width={1500} height={522}
          className="hidden md:block w-full h-auto object-cover"
          priority unoptimized
        />
      </section>

      {/* ══ INTRO STRIP ═══════════════════════════════════════ */}
      <section className="bg-[#F5C518] py-14 px-4 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-3">{t('about.title')}</h1>
        <p className="text-gray-800 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          {t('about.subtitle')}
        </p>
      </section>

      {/* ══ BRAND STORY ═══════════════════════════════════════ */}
      <section className="py-20 px-4 bg-gray-950">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-10 items-center">
          {/* Quote block */}
          <div className="flex-1 order-2 md:order-1">
            <span className="text-[#F5C518] text-6xl font-black leading-none select-none">"</span>
            <p className="text-white/80 text-base md:text-lg leading-loose -mt-4">
              {t('about.hero.text')}
            </p>
          </div>
          {/* Accent card */}
          <div className="flex-shrink-0 order-1 md:order-2 w-full md:w-72 rounded-3xl bg-gradient-to-br from-[#F5C518] to-amber-500
            p-8 text-gray-900 shadow-[6px_6px_0px_0px_rgba(245,197,24,0.3)]">
            <p className="text-4xl mb-3">🌟</p>
            <h2 className="text-xl font-black leading-snug">{t('about.brand.title')}</h2>
            <p className="text-sm mt-2 leading-relaxed opacity-80">{t('about.brand.text')}</p>
          </div>
        </div>
      </section>

      {/* ══ VISION / MISSION / GOAL ═══════════════════════════ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map((c) => (
              <div
                key={c.title}
                className="group relative rounded-3xl border border-gray-100 bg-white p-8
                  shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1
                  overflow-hidden"
              >
                {/* Background glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity
                  bg-gradient-to-br from-yellow-400 to-amber-600" />
                <Icon3D emoji={c.emoji} from={c.from} to={c.to} />
                <h2 className="text-xl font-black text-gray-900 mt-5 mb-2">{c.title}</h2>
                <p className="text-gray-500 text-sm leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ VALUES ════════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-10 text-center">
            {isRtl ? 'قيمنا' : 'Our Values'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-3xl bg-white border border-gray-100 p-7 flex flex-col gap-4
                  shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <Icon3D emoji={v.emoji} from={v.from} to={v.to} />
                <div>
                  <h3 className="font-black text-gray-900 text-lg mb-1">{v.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-[#F5C518] mb-12 text-center">
            {t('about.features.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex gap-5 items-start rounded-2xl bg-white/5 border border-white/10
                  p-6 hover:bg-white/10 transition-colors duration-200"
              >
                <Icon3D emoji={f.emoji} from={f.from} to={f.to} />
                <p className="text-white/80 text-sm leading-relaxed pt-1">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRODUCTS ══════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-[#FFFBF0]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-12 text-center">
            {t('about.products.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <div
                key={p.title}
                className="group bg-white rounded-3xl p-7 text-center border border-gray-100
                  shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-28 h-28 mx-auto mb-5 relative
                  drop-shadow-[0_8px_12px_rgba(0,0,0,0.15)]
                  group-hover:drop-shadow-[0_12px_20px_rgba(245,197,24,0.4)]
                  transition-all duration-300 group-hover:-translate-y-1">
                  <Image src={p.img} alt={p.title} fill className="object-contain" unoptimized />
                </div>
                <div className="w-10 h-1 rounded-full bg-[#F5C518] mx-auto mb-3" />
                <h3 className="font-black text-gray-900 text-base mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CATALOG ═══════════════════════════════════════════ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
            bg-gradient-to-br from-amber-300 to-yellow-500
            shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] text-3xl mb-6">
            📚
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-3">
            {t('about.catalog.title')}
          </h2>
          <p className="text-gray-500 leading-relaxed mb-8">{t('about.catalog.desc')}</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={CATALOG_PREVIEW}
              target="_blank" rel="noopener noreferrer"
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-4
                rounded-2xl transition shadow-md hover:shadow-lg hover:-translate-y-0.5 duration-200"
            >
              {t('about.catalog.preview')}
            </a>
            <a
              href={CATALOG_DOWNLOAD}
              target="_blank" rel="noopener noreferrer"
              className="bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-bold px-8 py-4
                rounded-2xl transition shadow-md hover:shadow-lg hover:-translate-y-0.5 duration-200"
            >
              {t('about.catalog.download')}
            </a>
          </div>
        </div>
      </section>

      {/* ══ CTA ═══════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-gradient-to-br from-[#F5C518] to-amber-400 text-center">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-6">
          {t('about.brand.title')}
        </h2>
        <Link
          href="/shop"
          className="inline-block bg-gray-900 hover:bg-gray-800 text-white font-bold
            px-10 py-4 rounded-2xl text-lg transition shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]
            hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 duration-200"
        >
          {t('about.cta')}
        </Link>
      </section>

    </div>
  );
}
