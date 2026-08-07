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
  const isInbox = pathname.startsWith('/tareeq/inbox');
  const isProfile = pathname === '/tareeq/profile' || pathname.startsWith('/tareeq/u/');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 sm:hidden z-40 print:hidden"
      style={{
        background: 'var(--tr-surface)',
        borderTop: '1px solid var(--tr-border-subtle)',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.08), 0 -4px 24px rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(64px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="h-16 flex items-center">
        {/* Home */}
        <NavItem href="/tareeq" active={isHome} label={isRtl ? 'الرئيسية' : 'Home'}>
          <HomeIcon filled={isHome} />
        </NavItem>

        {/* Camera — opens create modal */}
        <button
          onClick={onCreateClick}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative"
          aria-label={isRtl ? 'إضافة صورة' : 'Add photo'}
          style={{ color: 'var(--tr-text-secondary)' }}
        >
          <CameraIcon />
          <span className="text-[9px] font-semibold leading-none">{isRtl ? 'كاميرا' : 'Camera'}</span>
        </button>

        {/* Center CTA — dark blue star button */}
        <div className="flex-1 flex justify-center items-center">
          <button
            onClick={onCreateClick}
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{
              width: 56, height: 56,
              marginTop: -20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
              boxShadow: '0 6px 20px rgba(37,99,235,0.45), 0 2px 6px rgba(0,0,0,0.30)',
              border: '3px solid var(--tr-surface)',
            }}
            aria-label={isRtl ? 'اترك علامة' : 'Leave a Mark'}
          >
            {/* 5-pointed star — pushed above center */}
            <svg
              className="w-5 h-5"
              fill="#fff"
              viewBox="0 0 24 24"
              style={{ marginBottom: 9 }}
            >
              <polygon points="12,2 14.8,9.2 22.5,9.2 16.4,13.8 18.7,21 12,16.5 5.3,21 7.6,13.8 1.5,9.2 9.2,9.2" />
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
      style={{ color: active ? 'var(--tr-gold-bright)' : 'var(--tr-text-muted)' }}
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

function CameraIcon() {
  return (
    <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
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
