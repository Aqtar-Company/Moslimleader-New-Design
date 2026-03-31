'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isRtl } = useLang();
  const { totalItems } = useCart();
  const { totalItems: wishlistCount } = useWishlist();

  const links = [
    { href: '/',         label: isRtl ? 'الرئيسية'      : 'Home',     icon: '🏠' },
    { href: '/library',  label: isRtl ? 'المكتبة الرقمية': 'Library',  icon: '📚' },
    { href: '/cart',     label: isRtl ? `السلة (${totalItems})` : `Cart (${totalItems})`, icon: '🛒' },
    { href: '/wishlist', label: isRtl ? `المفضلة (${wishlistCount})` : `Wishlist (${wishlistCount})`, icon: '❤️' },
    { href: '/about',    label: isRtl ? 'من نحن'        : 'About',     icon: 'ℹ️' },
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
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: user info or sign in */}
        <div className="border-t border-gray-100 px-5 py-4">
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
              <button
                onClick={() => { signOut(); onClose(); }}
                className="w-full text-right text-xs text-red-500 hover:text-red-700 font-semibold py-1 transition"
              >
                {isRtl ? 'تسجيل الخروج' : 'Sign out'}
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
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
