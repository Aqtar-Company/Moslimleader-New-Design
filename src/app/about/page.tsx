'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

export default function AboutPage() {
  const { t } = useLang();

  return (
    <>
      {/* Banner */}
      <div className="relative h-48 md:h-64 bg-[#F5C518] overflow-hidden flex items-center justify-center">
        <div className="text-center z-10">
          <h1 className="text-3xl md:text-5xl font-black text-gray-900">{t('about.title')}</h1>
          <p className="text-gray-700 mt-2 text-lg">{t('about.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Mission */}
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-6">{t('about.mission.title')}</h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
            {t('about.mission.text')}
          </p>
        </div>

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: '📖', title: t('about.val1.title'), desc: t('about.val1.desc') },
            { icon: '🧠', title: t('about.val2.title'), desc: t('about.val2.desc') },
            { icon: '👨‍👩‍👧‍👦', title: t('about.val3.title'), desc: t('about.val3.desc') },
          ].map(v => (
            <div key={v.title} className="bg-gray-50 rounded-2xl p-6 text-center">
              <div className="text-5xl mb-4">{v.icon}</div>
              <h3 className="font-bold text-xl mb-2 text-gray-900">{v.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Logo section */}
        <div className="flex flex-col md:flex-row items-center gap-10 bg-[#FFF9E6] rounded-2xl p-8 mb-16">
          <Image
            src="https://moslimleader.com/wp-content/uploads/2024/10/Logo.webp"
            alt="Moslim Leader"
            width={160}
            height={64}
            className="h-16 w-auto object-contain"
            unoptimized
          />
          <div>
            <h3 className="font-black text-xl text-gray-900 mb-2">{t('about.brand.title')}</h3>
            <p className="text-gray-600 leading-relaxed">{t('about.brand.text')}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/shop"
            className="inline-block bg-[#F5C518] hover:bg-[#e0b000] text-gray-900 font-bold px-10 py-4 rounded-xl text-lg transition"
          >
            {t('about.cta')}
          </Link>
        </div>
      </div>
    </>
  );
}
