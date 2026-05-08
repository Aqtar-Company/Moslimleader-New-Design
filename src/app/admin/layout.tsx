'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
// Each nav item declares which permission(s) gate it. `requireAny: []` means
// the link is visible to any signed-in admin/staff (e.g. dashboard). Items
// with `superAdminOnly: true` only show for role='admin' (you).
type NavItem = {
  href: string;
  label: string;
  icon: string;
  requireAny?: string[];
  superAdminOnly?: boolean;
};
// Order: frequently-used daily ops at the top, then catalog &
// fulfilment, then customers/marketing, then reports, then config.
// Super-admin items (assistants management, valuation) live at the
// very bottom because they're rarely touched.
const NAV: NavItem[] = [
  // —— Daily ops ——
  { href: '/admin/dashboard',         label: 'الرئيسية',         icon: '📊', requireAny: [] },
  { href: '/admin/orders',            label: 'الطلبات',           icon: '📦', requireAny: ['orders.read'] },
  { href: '/admin/shipments',         label: 'شحنات بوسطة',       icon: '📮', requireAny: ['shipments.read'] },
  { href: '/admin/inventory',         label: 'المخزون',           icon: '📥', requireAny: ['inventory.read'] },
  { href: '/admin/inventory/movements', label: 'سجل المخزون',     icon: '🧾', requireAny: ['inventory.read'] },
  // —— Catalogue ——
  { href: '/admin/products',          label: 'المنتجات',          icon: '🛍️', requireAny: ['products.read'] },
  { href: '/admin/books',             label: 'المكتبة الرقمية',   icon: '📚', requireAny: ['books.read'] },
  { href: '/admin/series',            label: 'السلاسل',           icon: '📖', requireAny: ['books.read'] },
  // —— Production & sourcing ——
  { href: '/admin/production',        label: 'باتشات الإنتاج',    icon: '🏭', requireAny: ['production.read'] },
  { href: '/admin/suppliers',         label: 'الموردون',          icon: '🤝', requireAny: ['suppliers.read'] },
  // —— Customers & marketing ——
  { href: '/admin/customers',         label: 'قاعدة العملاء',     icon: '👥', requireAny: ['customers.read'] },
  { href: '/admin/wholesale',         label: 'تجار الجملة',       icon: '🏪', requireAny: ['wholesale.read'] },
  { href: '/admin/team',              label: 'الفريق والرواتب',   icon: '💼', requireAny: ['team.read'] },
  { href: '/admin/campaigns',         label: 'حملات التسويق',     icon: '📢', requireAny: ['campaigns.read'] },
  { href: '/admin/ai-facebook-assistant', label: 'مساعد فيسبوك AI', icon: '🤖', superAdminOnly: true },
  { href: '/admin/coupons',           label: 'الكوبونات',         icon: '🎟️', requireAny: ['coupons.read'] },
  { href: '/admin/reviews',           label: 'التقييمات',         icon: '⭐', requireAny: ['reviews.read'] },
  // —— Reports ——
  { href: '/admin/reports/sales-by-product', label: 'توزيع المبيعات', icon: '📊', requireAny: ['valuation.read'] },
  { href: '/admin/reports/bosta-orphans',    label: 'Backfill بوسطة',  icon: '📦', requireAny: ['inventory.read'] },
  // —— Configuration ——
  { href: '/admin/shipping',          label: 'الشحن المحلي',      icon: '🚚', requireAny: ['shipping.read'] },
  { href: '/admin/intl-shipping',     label: 'الشحن الدولي',      icon: '✈️', requireAny: ['shipping.read'] },
  { href: '/admin/payment-methods',   label: 'وسائل الدفع',       icon: '💳', requireAny: ['payment-methods.read'] },
  { href: '/admin/regional-pricing',  label: 'التسعير الإقليمي', icon: '🌍', requireAny: ['products.write'] },
  { href: '/admin/users',             label: 'إدارة المستخدمين', icon: '👤', superAdminOnly: true },
  // —— Pinned to bottom by user request ——
  { href: '/admin/staff',             label: 'صلاحيات المساعدين', icon: '🛡️', superAdminOnly: true },
  { href: '/admin/zakat',             label: 'حساب الزكاة',       icon: '🌙', requireAny: ['zakat.read'] },
  { href: '/admin/valuation',         label: 'تقييم الشركة',      icon: '💎', requireAny: ['valuation.read'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdminLike = user?.role === 'admin' || user?.role === 'staff';
  const isSuperAdmin = user?.role === 'admin';
  const userPerms = user?.permissions ?? [];
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth?redirect=' + pathname);
      return;
    }
    if (!isAdminLike) {
      router.replace('/');
    }
  }, [user, isLoading, isAdminLike, router, pathname]);

  if (isLoading || !user || !isAdminLike) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1a1a2e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="admin-shell fixed inset-0 z-50 flex bg-gray-100" dir="rtl">
      {/* Print fix: the admin shell is `position: fixed; overflow: hidden`
          for the screen layout, which clips print output to a single page.
          In print mode we strip the constraints so the browser can flow
          the report across as many pages as it needs. */}
      <style jsx global>{`
        @media print {
          .admin-shell {
            position: static !important;
            inset: auto !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: #fff !important;
          }
          .admin-shell aside, .admin-shell .admin-topbar { display: none !important; }
          .admin-shell .admin-main-wrap, .admin-shell main {
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
          }
        }
        /* Slim scrollbar for the desktop sidebar so the glass panel
           doesn't look chunky when the nav overflows. */
        .admin-sidebar-nav::-webkit-scrollbar { width: 4px; }
        .admin-sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
        .admin-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .admin-sidebar-nav { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — solid on mobile drawer (readability over a backdrop),
          glass on desktop (subtle depth without dominating the page). */}
      <aside className={`
        fixed top-0 right-0 h-full w-64 max-w-[85vw] bg-[#1a1a2e] z-50 flex flex-col transition-transform duration-300
        lg:static lg:translate-x-0 lg:w-52 lg:bg-[#0f0f1e]/92 lg:backdrop-blur-xl lg:border-l lg:border-white/15 lg:shadow-xl
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10 lg:px-4 lg:py-3.5">
          <p className="text-[#F5C518] font-black text-lg leading-tight lg:text-base">Moslim Leader</p>
          <p className="text-white/50 text-xs mt-0.5 lg:text-[10px]">لوحة التحكم</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto admin-sidebar-nav lg:py-2">
          {NAV.filter(item => {
            if (item.superAdminOnly) return isSuperAdmin;
            if (!item.requireAny || item.requireAny.length === 0) return true;
            if (isSuperAdmin) return true;
            return item.requireAny.some(p => userPerms.includes(p));
          }).map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-semibold transition-all lg:gap-2 lg:px-3.5 lg:py-2 lg:text-[12.5px] ${
                  active
                    ? 'bg-[#F5C518]/20 text-[#F5C518] border-l-0 border-r-4 border-[#F5C518]'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="text-base lg:text-sm">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: store link + logout */}
        <div className="px-4 py-4 border-t border-white/10 space-y-2 lg:px-2.5 lg:py-2.5 lg:space-y-1">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 text-xs transition lg:px-2 lg:py-1.5 lg:text-[11px]">
            <span>🏠</span> العودة للمتجر
          </Link>
          <button
            onClick={() => { signOut(); router.push('/'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-300 hover:text-red-200 hover:bg-white/10 text-xs transition lg:px-2 lg:py-1.5 lg:text-[11px]"
          >
            <span>🚪</span> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="admin-main-wrap flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="admin-topbar bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F5C518] flex items-center justify-center text-xs font-black text-[#1a1a2e]">
              {user.name.charAt(0)}
            </div>
            <span className="text-sm font-semibold text-gray-700 hidden sm:block">{user.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border hidden sm:block ${isSuperAdmin ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>{isSuperAdmin ? 'أدمن' : 'مساعد'}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ZakatReminderBanner userPerms={userPerms} isSuperAdmin={isSuperAdmin} />
          {children}
        </main>
      </div>
    </div>
  );
}

// Show a thin amber banner across the top of every admin page when
// 1 Dhul-Hijjah is within the next 7 days. The check runs client-side
// so the banner appears even when the user navigates between routes
// without a full reload. Self-dismissable per session.
function ZakatReminderBanner({ userPerms, isSuperAdmin }: { userPerms: string[]; isSuperAdmin: boolean }) {
  const [days, setDays] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Only users with zakat.read should see the reminder. We check the
  // permission client-side; the API is gated server-side anyway.
  const canSeeZakat = isSuperAdmin || userPerms.includes('zakat.read');

  useEffect(() => {
    if (!canSeeZakat) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('zakat-banner-dismissed') === '1') {
      setDismissed(true);
      return;
    }
    // Fetch the days-until from the API (it's the source of truth for
    // Hijri arithmetic — the JS engine on the client can disagree with
    // the server depending on locale data).
    fetch('/api/admin/zakat', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.today?.daysUntilDhulHijjah1 !== undefined) setDays(d.today.daysUntilDhulHijjah1);
      })
      .catch(() => {/* swallow — banner is best-effort */});
  }, [canSeeZakat]);

  if (!canSeeZakat || dismissed || days === null || days > 7) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-3 flex-wrap" dir="rtl">
      <p className="text-xs text-amber-900 font-bold flex items-center gap-2">
        <span className="text-base">🌙</span>
        {days === 0
          ? 'اليوم 1 ذو الحجة — موعد حساب زكاة عروض التجارة السنوية.'
          : `تبقى ${days} ${days === 1 ? 'يوم' : 'أيام'} على موعد حساب زكاة عروض التجارة السنوية.`}
      </p>
      <div className="flex gap-2">
        <Link href="/admin/zakat" className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition">
          🧮 احسب الآن
        </Link>
        <button
          onClick={() => { sessionStorage.setItem('zakat-banner-dismissed', '1'); setDismissed(true); }}
          className="px-2 py-1 rounded-lg text-amber-700 hover:bg-amber-100 text-[11px] font-bold transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
