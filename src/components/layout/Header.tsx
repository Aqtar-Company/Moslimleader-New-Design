'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';

export default function Header() {
  const { lang, toggleLang } = useLang();

  return (
    <header className="sticky top-0 z-50">
      <nav className="bg-[#F5C518]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Left: lang toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="flex items-center border-2 border-gray-800 rounded-lg px-3 h-10 hover:bg-yellow-300 transition font-bold text-gray-900 text-sm"
              aria-label="Switch language"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
          </div>

          {/* Right: logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="https://moslimleader.com/wp-content/uploads/2024/07/Logo.webp"
              alt="Moslim Leader"
              width={100}
              height={40}
              className="h-10 w-auto object-contain"
              unoptimized
            />
          </Link>
        </div>
      </nav>
    </header>
  );
}
