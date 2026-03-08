'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { lang, toggleLang } = useLang();
  const { totalItems } = useCart();
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="bg-gradient-to-b from-[#1a0f00]/80 to-transparent">
        <div className="max-w-6xl mx-auto px-4 h-20 grid grid-cols-3 items-center">

          {/* Left: Cart + Lang */}
          <div className="flex items-center gap-2">
            <Link href="/cart" className="relative flex items-center justify-center w-10 h-10 border-2 border-white/70 rounded-lg hover:bg-white/20 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -left-2 bg-[#F5C518] text-gray-900 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Link>

            <button
              onClick={toggleLang}
              className="flex items-center border-2 border-white/70 rounded-lg px-3 h-10 hover:bg-white/20 transition font-bold text-white text-sm"
              aria-label="Switch language"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link href="/">
              <Image
                src="/logo gold.png"
                alt="Moslim Leader"
                width={300}
                height={132}
                className="h-24 md:h-28 w-auto object-contain"
                unoptimized
              />
            </Link>
          </div>

          {/* Right: Sign In */}
          <div className="flex items-center justify-end">
            {!user && (
              <Link
                href="/auth"
                className="flex items-center border-2 border-white/70 rounded-lg px-3 h-10 hover:bg-white/20 transition font-bold text-white text-sm gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:block">{lang === 'ar' ? 'دخول' : 'Sign In'}</span>
              </Link>
            )}
          </div>

        </div>
      </nav>
    </header>
  );
}
