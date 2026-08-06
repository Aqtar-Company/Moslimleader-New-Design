'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { useLang } from '@/context/LanguageContext';

interface Props { onCreateClick: () => void; }

export default function TareeqBottomNav({ onCreateClick }: Props) {
  const pathname = usePathname();
  const { notifCount, messageCount } = useTareeqNotifications();
  const { isRtl } = useLang();

  const isHome  = pathname === '/tareeq';
  const isAlert = pathname.startsWith('/tareeq/notifications');
  const isInbox = pathname.startsWith('/tareeq/inbox');
  const isProfile = pathname === '/tareeq/profile' || pathname.startsWith('/tareeq/u/');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 sm:hidden z-40 print:hidden"
      style={{
        background: '#fff',
        borderTop: '1px solid rgba(26,20,18,0.08)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(64px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="h-16 flex items-center">
        {/* Home */}
        <NavItem href="/tareeq" active={isHome} label={isRtl ? 'الرئيسية' : 'Home'}>
          <HomeIcon filled={isHome} />
        </NavItem>

        {/* Search / Explore */}
        <NavItem href="/tareeq/notifications" active={isAlert} label={isRtl ? 'إشعارات' : 'Alerts'} badge={notifCount}>
          <SearchIcon filled={isAlert} />
        </NavItem>

        {/* Center CTA — floating coral button */}
        <div className="flex-1 flex justify-center items-center">
          <button
            onClick={onCreateClick}
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{
              width: 56, height: 56,
              marginTop: -20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff7857, #ff3d1a)',
              boxShadow: '0 6px 20px rgba(255,92,56,0.45), 0 2px 6px rgba(0,0,0,0.12)',
              border: '3px solid #fff',
            }}
            aria-label={isRtl ? 'اترك علامة' : 'Leave a Mark'}
          >
            <svg className="w-5 h-5" fill="none" stroke="#fff" strokeWidth={2.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Inbox / Messages */}
        <NavItem href="/tareeq/inbox" active={isInbox} label={isRtl ? 'رسائل' : 'Inbox'} badge={messageCount}>
          <MessageIcon filled={isInbox} />
        </NavItem>

        {/* Profile */}
        <NavItem href="/tareeq/profile" active={isProfile} label={isRtl ? 'حسابي' : 'Profile'}>
          <ProfileIcon filled={isProfile} />
        </NavItem>
      </div>
    </nav>
  );
}

function NavItem({ href, active, label, badge, children }: {
  href: string; active: boolean; label: string; badge?: number; children: React.ReactNode;
}) {
  const badgeLabel = badge && badge > 0 ? `${label} — ${badge > 99 ? '99+' : badge}` : label;
  return (
    <Link
      href={href}
      aria-label={badgeLabel}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative"
      style={{ color: active ? 'var(--tr-gold)' : '#9896a8' }}
    >
      <div className="relative" aria-hidden="true">
        {children}
        {!!badge && badge > 0 && (
          <span
            className="absolute -top-1.5 -end-1.5 min-w-[15px] h-[15px] rounded-full text-[9px] font-black flex items-center justify-center px-1 leading-none"
            style={{ background: '#f43f5e', color: '#fff' }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[9px] font-semibold leading-none" aria-hidden="true">{label}</span>
    </Link>
  );
}

function HomeIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

function SearchIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function MessageIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function ProfileIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-[22px] h-[22px]" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}
