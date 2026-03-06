'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';

export default function Header() {
  const { totalItems } = useCart();
  const { t, lang, toggleLang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/shop', label: t('nav.shop') },
    { href: '/about', label: t('nav.about') },
    { href: '/contact', label: t('nav.contact') },
  ];

  return (
    <header className="sticky top-0 z-50">
      {/* Top promo bar */}
      <div className="bg-gray-900 text-white text-center text-sm py-2 px-4">
        <span>{t('header.promo')}</span>
      </div>

      {/* Main header */}
      <nav className="bg-[#F5C518] shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Left: icons + lang toggle */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Link href="/cart" className="relative flex items-center justify-center w-10 h-10 border-2 border-gray-800 rounded-lg hover:bg-yellow-300 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 7h12.8M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -left-2 bg-gray-900 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* Wishlist */}
            <Link href="/shop" className="flex items-center justify-center w-10 h-10 border-2 border-gray-800 rounded-lg hover:bg-yellow-300 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center border-2 border-gray-800 rounded-lg px-3 h-10 hover:bg-yellow-300 transition font-bold text-gray-900 text-sm"
              aria-label="Switch language"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
          </div>

          {/* Center: nav links */}
          <div className="hidden md:flex items-center gap-6 font-semibold text-gray-900">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className="hover:text-gray-700 transition whitespace-nowrap">
                {link.label}
              </Link>
            ))}
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

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center w-10 h-10"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-yellow-400 bg-[#F5C518] px-4 py-3 flex flex-col gap-3 font-semibold">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="hover:text-gray-700">
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}
