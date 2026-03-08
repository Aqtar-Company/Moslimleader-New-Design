'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';

export default function AboutPage() {
  const { t, isRtl } = useLang();

  const pillars = [
    { titleKey: 'about.vision.title',  textKey: 'about.vision.text',  icon: '🌟' },
    { titleKey: 'about.mission.title', textKey: 'about.mission.text', icon: '🎯' },
    { titleKey: 'about.goal.title',    textKey: 'about.goal.text',    icon: '🏆' },
  ] as const;

  const features = [
    { text: t('about.feat1'), icon: '🎨' },
    { text: t('about.feat2'), icon: '📱' },
    { text: t('about.feat3'), icon: '🕌' },
    { text: t('about.feat4'), icon: '📦' },
  ];

  const products = [
    { titleKey: 'about.prod1.title', descKey: 'about.prod1.desc', icon: '📚' },
    { titleKey: 'about.prod2.title', descKey: 'about.prod2.desc', icon: '📖' },
    { titleKey: 'about.prod3.title', descKey: 'about.prod3.desc', icon: '🎲' },
    { titleKey: 'about.prod4.title', descKey: 'about.prod4.desc', icon: '📿' },
    { titleKey: 'about.prod5.title', descKey: 'about.prod5.desc', icon: '✏️' },
  ] as const;

  const values = [
    { titleKey: 'about.val1.title', descKey: 'about.val1.desc', icon: '☪️' },
    { titleKey: 'about.val2.title', descKey: 'about.val2.desc', icon: '✨' },
    { titleKey: 'about.val3.title', descKey: 'about.val3.desc', icon: '👨‍👩‍👧' },
  ] as const;

  return (
    <div className="min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Hero ── */}
      <div className="relative bg-gray-900 text-white pt-32 pb-20 overflow-hidden">
        {/* bg image */}
        <div className="absolute inset-0">
          <Image src="/about-hero.png" alt="" fill className="object-cover object-center opacity-20" unoptimized />
        </div>
        {/* yellow accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#F5C518]" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <span className="inline-block bg-[#F5C518] text-black text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-6">
            {t('about.title')}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-6">
            {t('about.subtitle')}
          </h1>
          <p className="text-gray-300 text-base leading-relaxed max-w-2xl mx-auto">
            {t('about.hero.text')}
          </p>
        </div>
      </div>

      {/* ── Vision / Mission / Goal ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map(p => (
            <div key={p.titleKey} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:border-[#F5C518] transition group">
              <div className="text-4xl mb-4">{p.icon}</div>
              <h3 className="font-black text-gray-900 text-lg mb-3 group-hover:text-[#F5C518] transition">
                {t(p.titleKey)}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">{t(p.textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What makes us different ── */}
      <section className="bg-[#F5C518] py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-black text-black mb-10 text-center">{t('about.features.title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <div key={i} className="bg-black/90 rounded-2xl p-5 flex gap-4 items-start">
                <span className="text-3xl shrink-0">{f.icon}</span>
                <p className="text-gray-300 text-sm leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Values ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-gray-900 mb-10 text-center">
          {isRtl ? 'قيمنا' : 'Our Values'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {values.map(v => (
            <div key={v.titleKey} className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#F5C518]/15 border-2 border-[#F5C518]/30 flex items-center justify-center text-3xl mx-auto mb-4">
                {v.icon}
              </div>
              <h3 className="font-black text-gray-900 mb-2">{t(v.titleKey)}</h3>
              <p className="text-gray-500 text-sm">{t(v.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Products ── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-black text-gray-900 mb-10 text-center">{t('about.products.title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map(p => (
              <div key={p.titleKey} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-[#F5C518]/40 transition">
                <span className="text-3xl block mb-3">{p.icon}</span>
                <h4 className="font-black text-gray-900 mb-2 text-sm">{t(p.titleKey)}</h4>
                <p className="text-gray-400 text-xs leading-relaxed">{t(p.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Brand story ── */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="w-12 h-1 bg-[#F5C518] mx-auto mb-8 rounded-full" />
        <h2 className="text-2xl font-black text-gray-900 mb-5">{t('about.brand.title')}</h2>
        <p className="text-gray-500 leading-relaxed mb-10">{t('about.brand.text')}</p>
        <Link
          href="/shop"
          className="inline-block bg-[#F5C518] text-black px-10 py-3.5 rounded-xl font-black hover:bg-yellow-400 transition shadow-md"
        >
          {t('about.cta')}
        </Link>
      </section>
    </div>
  );
}
