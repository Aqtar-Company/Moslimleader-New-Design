'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';

interface Props {
  onCreateClick: () => void;
  searchInput?: string;
  onSearch?: (v: string) => void;
  onToggleSidebar?: () => void;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -top-1 -end-1 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none"
      style={{ background: '#f43f5e', color: '#fff' }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function TareeqHeader({ onCreateClick, searchInput, onSearch, onToggleSidebar }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { notifCount } = useTareeqNotifications();

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 print:hidden"
        style={{
          background: 'rgba(255,255,255,0.93)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--tr-border-subtle)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.05)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          {/* Left: user avatar → profile */}
          <Link
            href="/tareeq/profile"
            className="shrink-0"
            aria-label={isRtl ? 'ملفي الشخصي' : 'My profile'}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? ''}
                className="w-9 h-9 rounded-full object-cover"
                style={{ border: '2px solid var(--tr-gold)' }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                style={{
                  background: 'var(--tr-gold-glow)',
                  color: 'var(--tr-gold)',
                  border: '2px solid var(--tr-gold)',
                }}
              >
                {user?.name?.charAt(0) ?? '?'}
              </div>
            )}
          </Link>

          {/* Center: search bar on feed, wordmark on other pages */}
          {onSearch !== undefined ? (
            <div className="flex items-center gap-2 flex-1 mx-2">
              <div className="relative flex-1">
                <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={searchInput ?? ''}
                  onChange={e => onSearch(e.target.value)}
                  placeholder={isRtl ? 'ابحث في العلامات...' : 'Search marks...'}
                  className="w-full rounded-full ps-8 pe-4 py-1.5 text-xs focus:outline-none transition"
                  style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                />
              </div>
              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className="lg:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition"
                  style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)' }}
                  aria-label={isRtl ? 'القائمة' : 'Menu'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <Link href="/tareeq" aria-label="Tareeq Home">
              <span className="font-black text-sm tracking-wide" style={{ color: 'var(--tr-text-primary)' }}>
                {isRtl ? 'طريق' : 'Tareeq'}
              </span>
            </Link>
          )}

          {/* Right: notifications bell */}
          <Link
            href="/tareeq/notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-full transition"
            style={{ background: 'var(--tr-raised)' }}
            aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <Badge count={notifCount} />
          </Link>
        </div>
      </header>
      {/* Spacer for fixed header */}
      <div className="h-14" />
    </>
  );
}
