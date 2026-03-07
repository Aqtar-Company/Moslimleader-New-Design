'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';

const CATALOG_PREVIEW  = 'https://drive.google.com/file/d/17LSwyrbq01E3D1ST2QDDqqJsSqSI4ofw/preview';
const CATALOG_DOWNLOAD = 'https://drive.google.com/uc?export=download&id=17LSwyrbq01E3D1ST2QDDqqJsSqSI4ofw';

export default function AboutPage() {
  const { t, isRtl } = useLang();

  const cards = [
    { icon: '🔭', title: t('about.vision.title'),  text: t('about.vision.text')  },
    { icon: '📜', title: t('about.mission.title'), text: t('about.mission.text') },
    { icon: '🎯', title: t('about.goal.title'),    text: t('about.goal.text')    },
  ];

  const features = [
    { icon: '🎨', text: t('about.feat1') },
    { icon: '📱', text: t('about.feat2') },
    { icon: '⚖️', text: t('about.feat3') },
    { icon: '🌐', text: t('about.feat4') },
  ];

  const products = [
    { img: '/icons/icon-books.png',      title: t('about.prod1.title'), desc: t('about.prod1.desc') },
    { img: '/icons/icon-stories.png',    title: t('about.prod2.title'), desc: t('about.prod2.desc') },
    { img: '/icons/icon-games.png',      title: t('about.prod3.title'), desc: t('about.prod3.desc') },
    { img: '/icons/icon-quran.png',      title: t('about.prod4.title'), desc: t('about.prod4.desc') },
    { img: '/icons/icon-stationery.png', title: t('about.prod5.title'), desc: t('about.prod5.desc') },
  ];

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── HERO ── */}
      <section className="relative w-full overflow-hidden mt-16" style={{ aspectRatio: '1500/522' }}>
        <Image
          src="/about-hero.png"
          alt={t('about.title')}
          fill
          className="object-cover object-center"
          priority
          unoptimized
        />
      </section>

      {/* ── VISION / MISSION / GOAL ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((c) => (
            <div key={c.title} className="bg-[#FFF9E6] rounded-2xl p-8 border-t-4 border-[#F5C518] shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-4xl mb-4">{c.icon}</div>
              <h2 className="text-xl font-black text-gray-900 mb-3">{c.title}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 px-4 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-[#F5C518] mb-10 pb-3 border-b-2 border-[#F5C518] inline-block">
            {t('about.features.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div key={i} className="flex gap-4 items-start bg-white/10 rounded-xl p-6 hover:bg-white/15 transition">
                <span className="text-3xl shrink-0">{f.icon}</span>
                <p className="text-white/90 text-sm leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ── */}
      <section className="py-16 px-4 bg-[#FFF9E6]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-10 pb-3 border-b-4 border-[#F5C518] inline-block">
            {t('about.products.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <div key={p.title} className="bg-white rounded-2xl p-6 text-center shadow-sm border-b-4 border-[#F5C518] hover:-translate-y-1 transition-transform">
                <div className="w-24 h-24 mx-auto mb-4 relative">
                  <Image src={p.img} alt={p.title} fill className="object-contain" unoptimized />
                </div>
                <h3 className="font-black text-gray-900 mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATALOG ── */}
      <section className="py-16 px-4 bg-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-4 pb-3 border-b-4 border-[#F5C518] inline-block">
            {t('about.catalog.title')}
          </h2>
          <p className="text-gray-600 mt-4 mb-8 leading-relaxed">{t('about.catalog.desc')}</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={CATALOG_PREVIEW}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-4 rounded-xl transition shadow-md"
            >
              {t('about.catalog.preview')}
            </a>
            <a
              href={CATALOG_DOWNLOAD}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-bold px-8 py-4 rounded-xl transition shadow-md"
            >
              {t('about.catalog.download')}
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-12 px-4 bg-[#F5C518] text-center">
        <Link
          href="/shop"
          className="inline-block bg-gray-900 hover:bg-gray-800 text-white font-bold px-10 py-4 rounded-xl text-lg transition"
        >
          {t('about.cta')}
        </Link>
      </section>

    </div>
  );
}
