'use client';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname ? usePathname() : '';
  const { notifCount, messageCount } = useTareeqNotifications();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Collapse on tap-outside (touchstart so it fires before blur on mobile)
  useEffect(() => {
    if (!mobileSearchOpen) return;
    function onTouch(e: TouchEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setMobileSearchOpen(false);
        if (!(searchInput ?? '').trim()) onSearch?.('');
      }
    }
    document.addEventListener('touchstart', onTouch, { passive: true });
    return () => document.removeEventListener('touchstart', onTouch);
  }, [mobileSearchOpen, searchInput, onSearch]);

  return (
    <>

      <header
        className="fixed top-0 left-0 right-0 z-50 print:hidden"
        style={{
          background: 'var(--tr-header-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--tr-border-subtle)',
          boxShadow: '0 2px 24px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="max-w-2xl mx-auto lg:max-w-[1180px] flex items-center px-4 h-14 gap-2 lg:gap-3">

          {/* ── MOBILE ONLY: compact icon → expands toward start (RTL=left, LTR=left) ── */}
          <div className="lg:hidden flex items-center w-full justify-end">
            <div
              ref={searchContainerRef}
              style={{
                position: 'relative',
                height: 40,
                width: mobileSearchOpen ? 'calc(100% - 4px)' : 44,
                transition: 'width 260ms cubic-bezier(0.4,0,0.2,1)',
                flexShrink: 0,
              }}
            >
              {/* Glass pill background */}
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 9999,
                background: mobileSearchOpen ? 'rgba(59,130,246,0.07)' : 'rgba(255,255,255,0.09)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: `1px solid ${mobileSearchOpen ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.13)'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                transition: 'background 200ms, border-color 200ms',
                pointerEvents: 'none',
              }} />

              {/* Input — only interactive when open */}
              <input
                ref={mobileSearchRef}
                value={searchInput ?? ''}
                onChange={e => onSearch?.(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setMobileSearchOpen(false); onSearch?.(''); } }}
                onBlur={() => { if (!(searchInput ?? '').trim()) setTimeout(() => setMobileSearchOpen(false), 120); }}
                placeholder={isRtl ? 'ابحث في طريق...' : 'Search Tareeq...'}
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: 9999,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: 'var(--tr-text-primary)',
                  paddingRight: 44,
                  paddingLeft: (searchInput ?? '').length > 0 && mobileSearchOpen ? 36 : 14,
                  opacity: mobileSearchOpen ? 1 : 0,
                  transition: 'opacity 180ms ease',
                  pointerEvents: mobileSearchOpen ? 'auto' : 'none',
                }}
              />

              {/* Clear × — visual left when text present */}
              {mobileSearchOpen && (searchInput ?? '').length > 0 && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSearch?.(''); mobileSearchRef.current?.focus(); }}
                  style={{
                    position: 'absolute',
                    left: 8, top: '50%', transform: 'translateY(-50%)',
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.13)',
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 2,
                    color: 'var(--tr-text-secondary)',
                    fontSize: 11, fontWeight: 700,
                  }}
                >✕</button>
              )}

              {/* Search icon — always on visual right, anchors the pill */}
              <button
                onClick={() => { if (!mobileSearchOpen) { setMobileSearchOpen(true); setTimeout(() => mobileSearchRef.current?.focus(), 50); } }}
                aria-label={isRtl ? 'بحث' : 'Search'}
                style={{
                  position: 'absolute',
                  right: 0, top: 0,
                  width: 44, height: 40,
                  background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 2, borderRadius: '50%',
                  color: mobileSearchOpen ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                  transition: 'color 200ms',
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── DESKTOP ONLY ── */}
          {/* Wordmark */}
          <Link href="/tareeq" className="hidden lg:flex items-center gap-2 shrink-0" aria-label="Tareeq">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', boxShadow: '0 2px 8px var(--tr-gold-glow)' }}>
              <svg className="w-4 h-4" fill="#fff" viewBox="0 0 24 24">
                <path d="M12 3l1.4 5.6L18.4 5.6l-3 4.4L21 12l-5.6 1.4 2.4 5.4-4.8-2.8L12 21l-1.4-5.6-5.4 2.4 2.8-4.8L3 12l5.6-1.4L6.2 5z" />
              </svg>
            </div>
            <span className="font-black text-xl tracking-tight" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'طريق' : 'Tareeq'}
            </span>
          </Link>

          {/* Desktop search bar */}
          {onSearch !== undefined && (
            <div className="hidden lg:block w-56 shrink-0">
              <div className="relative">
                <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={searchInput ?? ''}
                  onChange={e => onSearch(e.target.value)}
                  placeholder={isRtl ? 'بحث...' : 'Search...'}
                  className="w-full rounded-full ps-8 pe-4 py-2 text-xs focus:outline-none transition"
                  style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                />
              </div>
            </div>
          )}

          {/* Desktop center nav — Facebook-style icon tabs */}
          <div className="hidden lg:flex flex-1 items-center justify-center gap-1">
            {[
              { href: '/tareeq', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              ), label: isRtl ? 'الرئيسية' : 'Home', badge: 0 },
              { href: '/tareeq/inbox', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              ), label: isRtl ? 'الرسائل' : 'Messages', badge: messageCount },
              { href: '/tareeq/notifications', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              ), label: isRtl ? 'الإشعارات' : 'Notifications', badge: notifCount },
              { href: user ? `/tareeq/u/${user.id}` : '/tareeq', icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              ), label: isRtl ? 'ملفي' : 'Profile', badge: 0 },
            ].map(({ href, icon, label, badge }) => {
              const active = pathname === href || (href !== '/tareeq' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className="relative flex items-center justify-center w-24 h-12 rounded-xl transition-colors group"
                  style={{
                    color: active ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                    borderBottom: active ? '3px solid var(--tr-gold)' : '3px solid transparent',
                    background: 'transparent',
                  }}
                >
                  {icon}
                  {badge > 0 && (
                    <span className="absolute top-1.5 end-3 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-black px-0.5" style={{ background: '#f43f5e', color: '#fff' }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: desktop actions only */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {/* Desktop: user avatar + "New Mark" */}
            {user && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onCreateClick}
                  className="flex items-center gap-1.5 font-black text-xs px-4 py-2 rounded-full transition active:scale-95"
                  style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#fff', boxShadow: '0 2px 10px var(--tr-gold-glow)' }}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {isRtl ? 'علامة جديدة' : 'New Mark'}
                </button>
                <Link href={`/tareeq/u/${user.id}`} className="shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name ?? ''} className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid var(--tr-gold-dim)' }} />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
                      {user.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </Link>
              </div>
            )}
            {!user && (
              <Link href="/login?next=/tareeq" className="hidden lg:flex items-center gap-1.5 font-bold text-xs px-4 py-2 rounded-full transition" style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-primary)', border: '1px solid var(--tr-border-soft)' }}>
                {isRtl ? 'تسجيل الدخول' : 'Sign In'}
              </Link>
            )}
          </div>
        </div>
      </header>
      <div className="h-14" />
    </>
  );
}
