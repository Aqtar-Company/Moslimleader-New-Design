'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useState, useEffect } from 'react';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

type MemberStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING' | null;

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isRtl, lang, toggleLang } = useLang();
  const { totalItems } = useCart();
  const { totalItems: wishlistCount } = useWishlist();
  const [memberStatus, setMemberStatus] = useState<MemberStatus>(null);

  /* Fetch membership status whenever the menu opens and user is logged in */
  useEffect(() => {
    if (!open || !user) { setMemberStatus(null); return; }
    fetch('/api/membership', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setMemberStatus(d?.membership?.status ?? null))
      .catch(() => {});
  }, [open, user]);

  const links = [
    { href: '/',           label: isRtl ? 'الرئيسية'       : 'Home',       icon: '🏠' },
    { href: '/tareeq',     label: isRtl ? 'طريق'           : 'Tareeq',     icon: '🌟', logoImg: '/Tareeq-small.png' },
    { href: '/library',    label: isRtl ? 'المكتبة الرقمية' : 'Library',    icon: '📚' },
    ...(user ? [{ href: '/membership', label: isRtl ? 'عضوية الأسرة' : 'Family Membership', icon: '🪙',
      badge: memberStatus === 'ACTIVE' ? (isRtl ? 'فعّالة' : 'Active')
           : memberStatus === 'EXPIRED' || memberStatus === 'CANCELLED' ? (isRtl ? 'مجتمع' : 'Community')
           : null,
    }] : []),
    { href: '/cart',       label: isRtl ? `السلة (${totalItems})` : `Cart (${totalItems})`, icon: '🛒' },
    { href: '/wishlist',   label: isRtl ? `المفضلة (${wishlistCount})` : `Wishlist (${wishlistCount})`, icon: '❤️' },
    { href: '/about',      label: isRtl ? 'من نحن'         : 'About',       icon: 'ℹ️' },
  ];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-72 bg-white z-[70] flex flex-col shadow-2xl md:hidden"
        style={{ animation: 'menu-in 0.28s ease-out' }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
          <p className="font-black text-[#1a1a2e] text-base">Moslim Leader</p>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg transition"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3">
          {links.map(link => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-5 py-3.5 text-sm font-bold transition ${
                  active
                    ? 'bg-[#F5C518]/10 text-[#1a1a2e] border-r-4 border-[#F5C518]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {'logoImg' in link && link.logoImg
                  ? <img src={link.logoImg as string} alt="" className="w-6 h-6" />
                  : <span className="text-lg">{link.icon}</span>}
                <span className="flex-1">{link.label}</span>
                {'badge' in link && link.badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(74,222,128,0.12)', color: '#16a34a',
                    border: '1px solid rgba(74,222,128,0.3)',
                  }}>
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-3 w-full px-5 py-3.5 border-t border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
        >
          <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-black text-gray-700">
            {lang === 'ar' ? 'EN' : 'ع'}
          </span>
          {lang === 'ar' ? 'English' : 'العربية'}
        </button>

        {/* Footer: user info or sign in */}
        <div className="px-5 py-4">
          {user ? (
            <div className="space-y-2">
              <Link
                href="/account"
                onClick={onClose}
                className="flex items-center gap-3 text-sm font-bold text-gray-700 hover:text-gray-900 py-1"
              >
                <div className="w-8 h-8 rounded-full bg-[#F5C518] flex items-center justify-center text-[#1a1a2e] font-black text-sm">
                  {user.name.charAt(0)}
                </div>
                {user.name}
              </Link>

              {/* Membership status chip */}
              {memberStatus && (
                <Link
                  href="/membership"
                  onClick={onClose}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20, marginBottom: 4,
                    background: memberStatus === 'ACTIVE'
                      ? 'rgba(74,222,128,0.12)'
                      : memberStatus === 'PENDING'
                        ? 'rgba(251,191,36,0.12)'
                        : 'rgba(74,222,128,0.12)',
                    border: `1px solid ${memberStatus === 'ACTIVE'
                      ? 'rgba(74,222,128,0.35)'
                      : memberStatus === 'PENDING'
                        ? 'rgba(251,191,36,0.35)'
                        : 'rgba(74,222,128,0.35)'}`,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: memberStatus === 'ACTIVE' || memberStatus === 'EXPIRED' || memberStatus === 'CANCELLED'
                        ? '#4ade80' : '#fbbf24',
                      boxShadow: '0 0 6px rgba(74,222,128,0.6)',
                    }} />
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: memberStatus === 'ACTIVE' || memberStatus === 'EXPIRED' || memberStatus === 'CANCELLED'
                        ? '#16a34a' : '#d97706',
                    }}>
                      {memberStatus === 'ACTIVE'
                        ? (isRtl ? 'عضوية فعّالة' : 'Active Member')
                        : memberStatus === 'PENDING'
                          ? (isRtl ? 'قيد المعالجة' : 'Pending')
                          : (isRtl ? 'عضوية مجتمع' : 'Community')}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#9ca3af', flexShrink: 0 }}>
                      <path d={isRtl ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}/>
                    </svg>
                  </div>
                </Link>
              )}

              <button
                onClick={() => { signOut(); onClose(); }}
                className="w-full text-right text-xs text-red-500 hover:text-red-700 font-semibold py-1 transition"
              >
                {isRtl ? 'تسجيل الخروج' : 'Sign out'}
              </button>
            </div>
          ) : (
            <Link
              href='/login'
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full bg-[#1a1a2e] hover:bg-gray-800 text-white font-black py-3 rounded-xl text-sm transition"
            >
              {isRtl ? 'تسجيل الدخول / حساب جديد' : 'Sign In / Register'}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
