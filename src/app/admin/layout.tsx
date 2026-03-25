'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_EMAIL } from '@/lib/admin-config';

const NAV = [
  { href: '/admin/dashboard',         label: 'الرئيسية',       icon: '📊' },
  { href: '/admin/orders',            label: 'الطلبات',         icon: '📦' },
  { href: '/admin/products',          label: 'المنتجات',        icon: '🛍️' },
  { href: '/admin/regional-pricing',  label: 'التسعير الإقليمي', icon: '🌍' },
  { href: '/admin/coupons',           label: 'الكوبونات',       icon: '🎟️' },
  { href: '/admin/users',             label: 'العملاء',         icon: '👥' },
  { href: '/admin/reviews',           label: 'التقييمات',       icon: '⭐' },
  { href: '/admin/shipping',          label: 'الشحن المحلي',    icon: '🚚' },
  { href: '/admin/intl-shipping',     label: 'الشحن الدولي',    icon: '✈️' },
  { href: '/admin/payment-methods',   label: 'وسائل الدفع',     icon: '💳' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth?redirect=' + pathname);
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      router.replace('/');
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1a1a2e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-100" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 right-0 h-full w-64 bg-[#1a1a2e] z-50 flex flex-col transition-transform duration-300
        lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <p className="text-[#F5C518] font-black text-lg leading-tight">Moslim Leader</p>
          <p className="text-white/50 text-xs mt-0.5">لوحة التحكم</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition-all ${
                  active
                    ? 'bg-[#F5C518]/15 text-[#F5C518] border-l-0 border-r-4 border-[#F5C518]'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: store link + logout */}
        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white text-xs transition">
            <span>🏠</span> العودة للمتجر
          </Link>
          <button
            onClick={() => { signOut(); router.push('/'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-white/5 text-xs transition"
          >
            <span>🚪</span> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F5C518] flex items-center justify-center text-xs font-black text-[#1a1a2e]">
              {user.name.charAt(0)}
            </div>
            <span className="text-sm font-semibold text-gray-700 hidden sm:block">{user.name}</span>
            <span className="text-xs text-gray-400 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hidden sm:block">أدمن</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
