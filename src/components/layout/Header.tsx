'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { totalItems } = useCart();
  const { t, lang, toggleLang } = useLang();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isRtl = lang === 'ar';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/shop', label: t('nav.shop') },
    { href: '/media', label: isRtl ? 'الوسائط' : 'Media' },
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

            {/* User / Sign in */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2 border-2 border-gray-800 rounded-lg px-2.5 h-10 hover:bg-yellow-300 transition"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-gray-900 hidden sm:block max-w-[80px] truncate">{user.name.split(' ')[0]}</span>
                </button>
                {userMenuOpen && (
                  <div className={`absolute top-12 ${isRtl ? 'left-0' : 'right-0'} bg-white rounded-2xl shadow-lg border border-gray-100 py-2 min-w-[160px] z-50`}>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-bold text-gray-900 text-sm truncate">{user.name}</p>
                      <p className="text-gray-500 text-xs truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { signOut(); setUserMenuOpen(false); }}
                      className="w-full text-start px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    >
                      {isRtl ? 'تسجيل الخروج' : 'Sign Out'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth"
                className="flex items-center border-2 border-gray-800 rounded-lg px-3 h-10 hover:bg-yellow-300 transition font-bold text-gray-900 text-sm gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:block">{isRtl ? 'دخول' : 'Sign In'}</span>
              </Link>
            )}

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
          <div className="hidden md:flex items-center gap-5 font-semibold text-gray-900">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className="hover:text-gray-700 transition whitespace-nowrap text-sm">
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
            <div className="border-t border-yellow-400 pt-3">
              {user ? (
                <button onClick={() => { signOut(); setMenuOpen(false); }} className="text-red-700 font-semibold text-sm">
                  {isRtl ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              ) : (
                <Link href="/auth" onClick={() => setMenuOpen(false)} className="text-gray-900 font-semibold text-sm">
                  {isRtl ? 'تسجيل الدخول / حساب جديد' : 'Sign In / Sign Up'}
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
