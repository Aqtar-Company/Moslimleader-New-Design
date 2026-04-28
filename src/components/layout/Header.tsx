'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLang } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import MobileMenu from './MobileMenu';

const iconBtn = 'relative flex items-center justify-center w-10 h-10 border-2 border-white/70 rounded-lg hover:bg-white/20 transition text-white';

export default function Header() {
  const { lang, toggleLang } = useLang();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [banner, setBanner] = useState<{ code: string; discount: number; bannerText?: string; bannerColor?: string } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/coupons', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.banner) setBanner(d.banner); })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {banner && !bannerDismissed && (
        <div
          className="relative text-center py-2 px-8 text-sm font-bold"
          style={{ background: banner.bannerColor || '#F5C518', color: (banner.bannerColor || '').toLowerCase() === '#1a1a1a' ? '#fff' : '#1a1a1a' }}
        >
          <span>{banner.bannerText || `استخدم كود ${banner.code} واحصل على خصم ${banner.discount}%`}</span>
          <span className="mx-2 bg-black/20 text-white px-2 py-0.5 rounded-full text-xs font-black tracking-wider">{banner.code}</span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition text-lg leading-none"
            aria-label="إغلاق"
          >×</button>
        </div>
      )}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <nav className="bg-gradient-to-b from-[#1a0f00]/80 to-transparent backdrop-blur-sm" style={{ WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-6xl mx-auto px-4 h-20 grid grid-cols-3 items-center">

          {/* Side A (Right in RTL): Cart + Library */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Link href="/cart" className={iconBtn} aria-label="Cart">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#F5C518] text-gray-900 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* Digital Library */}
            <Link href="/library" className={iconBtn} aria-label="المكتبة الرقمية">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </Link>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link href="/">
              {/* Mobile logo — slightly bigger */}
              <Image
                src="/logo-mobile.png"
                alt="Moslim Leader"
                width={160}
                height={64}
                className="md:hidden h-16 w-auto object-contain"
                unoptimized
              />
              {/* Desktop logo */}
              <Image
                src="/logo gold.png"
                alt="Moslim Leader"
                width={300}
                height={132}
                className="hidden md:block h-28 w-auto object-contain"
                unoptimized
              />
            </Link>
          </div>

          {/* Side B (Left in RTL): Lang + Account + Hamburger */}
          <div className="flex items-center justify-end gap-2">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className={`${iconBtn} font-black text-sm`}
              aria-label="Switch language"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>

            {/* Sign In / Account — hidden on mobile (use drawer instead) */}
            {!user ? (
              <Link href="/auth" className={`${iconBtn} hidden md:flex`} aria-label="Sign in">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            ) : (
              <Link href="/account" className={`${iconBtn} hidden md:flex relative`} aria-label="Account">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-400 rounded-full border border-[#1a0f00]" />
              </Link>
            )}

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen(true)}
              className={`${iconBtn} md:hidden`}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

        </div>
      </nav>
    </header>
  );
}
