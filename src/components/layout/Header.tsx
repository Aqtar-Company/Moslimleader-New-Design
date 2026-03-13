'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';

const iconBtn = 'relative flex items-center justify-center w-10 h-10 border-2 border-white/70 rounded-lg hover:bg-white/20 transition text-white';

const EGYPT_ENTRY = { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', flag: '🇪🇬', currencyEn: 'EGP' };

const ZONE_GROUPS = [
  {
    labelAr: 'الخليج', labelEn: 'Gulf',
    countries: [
      { code: 'SA', nameAr: 'السعودية',   nameEn: 'Saudi Arabia', flag: '🇸🇦', currencyEn: 'SAR' },
      { code: 'AE', nameAr: 'الإمارات',   nameEn: 'UAE',          flag: '🇦🇪', currencyEn: 'AED' },
      { code: 'KW', nameAr: 'الكويت',     nameEn: 'Kuwait',       flag: '🇰🇼', currencyEn: 'KWD' },
      { code: 'QA', nameAr: 'قطر',        nameEn: 'Qatar',        flag: '🇶🇦', currencyEn: 'QAR' },
      { code: 'BH', nameAr: 'البحرين',    nameEn: 'Bahrain',      flag: '🇧🇭', currencyEn: 'BHD' },
      { code: 'OM', nameAr: 'عُمان',       nameEn: 'Oman',         flag: '🇴🇲', currencyEn: 'OMR' },
    ],
  },
  {
    labelAr: 'عربي', labelEn: 'Arab',
    countries: [
      { code: 'JO', nameAr: 'الأردن',     nameEn: 'Jordan',       flag: '🇯🇴', currencyEn: 'JOD' },
      { code: 'LB', nameAr: 'لبنان',      nameEn: 'Lebanon',      flag: '🇱🇧', currencyEn: 'USD' },
    ],
  },
  {
    labelAr: 'دولي', labelEn: 'International',
    countries: [
      { code: 'US', nameAr: 'أمريكا',     nameEn: 'USA',          flag: '🇺🇸', currencyEn: 'USD' },
      { code: 'GB', nameAr: 'بريطانيا',   nameEn: 'UK',           flag: '🇬🇧', currencyEn: 'GBP' },
      { code: 'DE', nameAr: 'أوروبا',     nameEn: 'Europe',       flag: '🇩🇪', currencyEn: 'EUR' },
      { code: 'CA', nameAr: 'كندا',       nameEn: 'Canada',       flag: '🇨🇦', currencyEn: 'CAD' },
      { code: 'AU', nameAr: 'أستراليا',   nameEn: 'Australia',    flag: '🇦🇺', currencyEn: 'AUD' },
      { code: 'TR', nameAr: 'تركيا',      nameEn: 'Turkey',       flag: '🇹🇷', currencyEn: 'TRY' },
    ],
  },
];

const ALL_ZONE_COUNTRIES = ZONE_GROUPS.flatMap(g => g.countries);

function getCurrentDisplay(countryCode: string | null, zone: string) {
  if (!countryCode || countryCode === 'EG' || zone === 'egypt') return EGYPT_ENTRY;
  return ALL_ZONE_COUNTRIES.find(c => c.code === countryCode)
    ?? { code: 'WORLD', nameAr: 'دولي', nameEn: 'International', flag: '🌐', currencyEn: 'USD' };
}

export default function Header() {
  const { lang, toggleLang } = useLang();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const { totalItems: wishlistCount } = useWishlist();
  const { zone, countryCode, setCountry } = useRegionalPricing();
  const [zoneOpen, setZoneOpen] = useState(false);
  const isRtl = lang === 'ar';

  const current = getCurrentDisplay(countryCode, zone);

  function selectCountry(code: string) {
    setCountry(code === 'WORLD' ? null : code);
    setZoneOpen(false);
  }

  const isWorldFallback = zone === 'world' && !ALL_ZONE_COUNTRIES.some(c => c.code === current.code);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="bg-gradient-to-b from-[#1a0f00]/80 to-transparent">
        <div className="max-w-6xl mx-auto px-4 h-20 grid grid-cols-3 items-center">

          {/* Side A: Cart + Wishlist */}
          <div className="flex items-center gap-2">
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

          {/* Side B: Lang + Zone + Sign In */}
          <div className="flex items-center justify-end gap-2">

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className={`${iconBtn} font-black text-sm`}
              aria-label="Switch language"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>

            {/* Country / Zone Switcher */}
            <div className="relative">
              <button
                onClick={() => setZoneOpen(o => !o)}
                className={`${iconBtn} text-base`}
                aria-label="تغيير الدولة"
                title={isRtl ? current.nameAr : current.nameEn}
              >
                {current.flag}
              </button>

              {zoneOpen && (
                <div
                  className="absolute left-0 top-12 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 w-52 overflow-y-auto"
                  style={{ maxHeight: '72vh' }}
                  dir="rtl"
                >
                  {/* Egypt */}
                  <button
                    onClick={() => selectCountry('EG')}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold hover:bg-gray-50 transition border-b border-gray-100 ${
                      zone === 'egypt' ? 'bg-[#f5c518]/20 text-[#1a1a2e]' : 'text-gray-700'
                    }`}
                  >
                    <span>🇪🇬</span>
                    <div className="flex-1 text-right leading-tight">
                      <span>{isRtl ? 'مصر' : 'Egypt'}</span>
                      <span className="text-[10px] text-gray-400 font-normal mr-1">EGP</span>
                    </div>
                    {zone === 'egypt' && <span className="text-[#b8960c] text-xs">✓</span>}
                  </button>

                  {/* Groups */}
                  {ZONE_GROUPS.map(group => (
                    <div key={group.labelAr}>
                      <div className="px-3 py-1 bg-gray-50 border-y border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {isRtl ? group.labelAr : group.labelEn}
                        </p>
                      </div>
                      {group.countries.map(c => {
                        const isActive = current.code === c.code;
                        return (
                          <button
                            key={c.code}
                            onClick={() => selectCountry(c.code)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition ${
                              isActive ? 'bg-[#f5c518]/20 font-bold text-[#1a1a2e]' : 'text-gray-700'
                            }`}
                          >
                            <span>{c.flag}</span>
                            <div className="flex-1 text-right leading-tight">
                              <span className="font-semibold">{isRtl ? c.nameAr : c.nameEn}</span>
                              <span className="text-[10px] text-gray-400 font-normal mr-1">{c.currencyEn}</span>
                            </div>
                            {isActive && <span className="text-[#b8960c] text-xs shrink-0">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* World/USD fallback */}
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => selectCountry('WORLD')}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition ${
                        isWorldFallback ? 'bg-[#f5c518]/20 font-bold text-[#1a1a2e]' : 'text-gray-700'
                      }`}
                    >
                      <span>🌐</span>
                      <div className="flex-1 text-right leading-tight">
                        <span className="font-semibold">{isRtl ? 'دولي' : 'International'}</span>
                        <span className="text-[10px] text-gray-400 font-normal mr-1">USD</span>
                      </div>
                      {isWorldFallback && <span className="text-[#b8960c] text-xs shrink-0">✓</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>

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
