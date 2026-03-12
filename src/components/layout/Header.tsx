'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { ZONES, PricingZone } from '@/lib/geo-pricing';

const iconBtn = 'relative flex items-center justify-center w-10 h-10 border-2 border-white/70 rounded-lg hover:bg-white/20 transition text-white';

const ZONE_OPTIONS: { zone: PricingZone; label: string; flag: string }[] = [
  { zone: 'egypt', label: 'مصر — ج.م',   flag: '🇪🇬' },
  { zone: 'saudi', label: 'السعودية — ﷼', flag: '🇸🇦' },
  { zone: 'world', label: 'دولي — USD',   flag: '🌐' },
];

export default function Header() {
  const { lang, toggleLang } = useLang();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const { totalItems: wishlistCount } = useWishlist();
  const { zone, setZone, zoneInfo } = useRegionalPricing();
  const [showZoneMenu, setShowZoneMenu] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="bg-gradient-to-b from-[#1a0f00]/80 to-transparent">
        <div className="max-w-6xl mx-auto px-4 h-20 grid grid-cols-3 items-center">

          {/* Side A: Cart + Wishlist */}
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

            {/* Wishlist */}
            <Link href="/wishlist" className={iconBtn} aria-label="Wishlist">
              <svg className="w-5 h-5" fill={wishlistCount > 0 ? '#ef4444' : 'none'} stroke={wishlistCount > 0 ? '#ef4444' : 'currentColor'} strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {wishlistCount}
                </span>
              )}
            </Link>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link href="/">
              <Image src="/logo-mobile.png" alt="Moslim Leader" width={140} height={56} className="md:hidden h-14 w-auto object-contain" unoptimized />
              <Image src="/logo gold.png" alt="Moslim Leader" width={300} height={132} className="hidden md:block h-28 w-auto object-contain" unoptimized />
            </Link>
          </div>

          {/* Side B: Zone selector + Lang + Sign In/Account */}
          <div className="flex items-center justify-end gap-2">

            {/* Zone / Currency selector */}
            <div className="relative">
              <button
                onClick={() => setShowZoneMenu(v => !v)}
                className={`${iconBtn} text-xs font-black`}
                aria-label="تغيير العملة"
                title={zoneInfo.label}
              >
                <span className="text-base">{zoneInfo.flag}</span>
              </button>
              {showZoneMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowZoneMenu(false)} />
                  {/* Dropdown */}
                  <div className="absolute left-0 top-12 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[180px]" dir="rtl">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">العملة / المنطقة</p>
                    </div>
                    {ZONE_OPTIONS.map(opt => (
                      <button
                        key={opt.zone}
                        onClick={() => { setZone(opt.zone); setShowZoneMenu(false); }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-right transition hover:bg-gray-50 ${zone === opt.zone ? 'bg-amber-50 text-amber-800 font-bold' : 'text-gray-700'}`}
                      >
                        <span className="text-base">{opt.flag}</span>
                        <span>{opt.label}</span>
                        {zone === opt.zone && <span className="mr-auto text-amber-500 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className={`${iconBtn} font-black text-sm`}
              aria-label="Switch language"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>

            {/* Sign In / Account */}
            {!user ? (
              <Link href="/auth" className={iconBtn} aria-label="Sign in">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            ) : (
              <Link href="/account" className={`${iconBtn} relative`} aria-label="Account">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-400 rounded-full border border-[#1a0f00]" />
              </Link>
            )}
          </div>

        </div>
      </nav>
    </header>
  );
}
