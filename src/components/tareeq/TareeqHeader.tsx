'use client';
import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

/* ── Types ── */
interface Notification {
  id: string; type: string; actorName?: string | null; postId?: string | null;
  postTitle?: string | null; body?: string | null; read: boolean; createdAt: string;
}
interface OtherUser { id: string; name: string; avatarUrl?: string | null }
interface Conversation {
  id: string; lastMessage?: string | null; lastMessageAt?: string | null;
  unreadCount: number; otherUser: OtherUser;
}

function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return isRtl ? 'الآن' : 'now';
  if (diff < 3600) return isRtl ? `${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return isRtl ? `${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h`;
  return isRtl ? `${Math.floor(diff / 86400)} ي` : `${Math.floor(diff / 86400)}d`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'like') return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(244,63,94,0.12)' }}>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#f43f5e' }}>
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    </div>
  );
  if (type === 'comment') return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(45,212,191,0.10)' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-teal)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--tr-gold-glow)' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    </div>
  );
}

export default function TareeqHeader({ onCreateClick, searchInput, onSearch, onToggleSidebar }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname ? usePathname() : '';
  const { notifCount, messageCount } = useTareeqNotifications();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  /* ── Desktop notification panel state ── */
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifPanelVisible, setNotifPanelVisible] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  /* ── Desktop messages panel state ── */
  const [showMsgPanel, setShowMsgPanel] = useState(false);
  const [msgPanelVisible, setMsgPanelVisible] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const msgPanelRef = useRef<HTMLDivElement>(null);
  const msgBtnRef = useRef<HTMLButtonElement>(null);

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

  /* ── Panel animation helpers ── */
  useEffect(() => {
    if (showNotifPanel) { requestAnimationFrame(() => setNotifPanelVisible(true)); }
    else { setNotifPanelVisible(false); }
  }, [showNotifPanel]);

  useEffect(() => {
    if (showMsgPanel) { requestAnimationFrame(() => setMsgPanelVisible(true)); }
    else { setMsgPanelVisible(false); }
  }, [showMsgPanel]);

  /* ── Click-outside to close panels ── */
  useEffect(() => {
    if (!showNotifPanel && !showMsgPanel) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (showNotifPanel && notifPanelRef.current && !notifPanelRef.current.contains(t) && notifBtnRef.current && !notifBtnRef.current.contains(t)) {
        setShowNotifPanel(false);
      }
      if (showMsgPanel && msgPanelRef.current && !msgPanelRef.current.contains(t) && msgBtnRef.current && !msgBtnRef.current.contains(t)) {
        setShowMsgPanel(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showNotifPanel, showMsgPanel]);

  /* ── Load notifications ── */
  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const res = await fetch('/api/tareeq/notifications?limit=20', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setNotifs(d.notifications ?? []);
      }
    } catch { /* offline */ }
    setNotifsLoading(false);
    // Mark all read
    fetch('/api/tareeq/notifications', { method: 'POST', credentials: 'include' }).catch(() => {});
  }, []);

  /* ── Load conversations ── */
  const loadConversations = useCallback(async () => {
    setMsgsLoading(true);
    try {
      const res = await fetch('/api/tareeq/conversations', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setConversations(d.conversations ?? []);
      }
    } catch { /* offline */ }
    setMsgsLoading(false);
  }, []);

  function toggleNotifPanel(e: React.MouseEvent) {
    e.preventDefault();
    if (!showNotifPanel) {
      loadNotifs();
      setShowMsgPanel(false);
    }
    setShowNotifPanel(p => !p);
  }

  function toggleMsgPanel(e: React.MouseEvent) {
    e.preventDefault();
    if (!showMsgPanel) {
      loadConversations();
      setShowNotifPanel(false);
    }
    setShowMsgPanel(p => !p);
  }

  /* ── Nav items config ── */
  const navItems = [
    {
      key: 'home',
      href: '/tareeq',
      label: isRtl ? 'الرئيسية' : 'Home',
      badge: 0,
      onClick: undefined as ((e: React.MouseEvent) => void) | undefined,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      key: 'messages',
      href: '/tareeq/inbox',
      label: isRtl ? 'الرسائل' : 'Messages',
      badge: messageCount,
      onClick: toggleMsgPanel,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
    },
    {
      key: 'notifications',
      href: '/tareeq/notifications',
      label: isRtl ? 'الإشعارات' : 'Notifications',
      badge: notifCount,
      onClick: toggleNotifPanel,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      key: 'profile',
      href: user ? `/tareeq/u/${user.id}` : '/tareeq',
      label: isRtl ? 'ملفي' : 'Profile',
      badge: 0,
      onClick: undefined as ((e: React.MouseEvent) => void) | undefined,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  /* ── Panel style helpers ── */
  const panelBase: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    marginTop: 8,
    width: 340,
    borderRadius: 16,
    background: 'var(--tr-surface)',
    border: '1px solid var(--tr-border-soft)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
    overflow: 'hidden',
    zIndex: 200,
    transformOrigin: 'top center',
    transition: 'opacity 200ms ease, transform 200ms ease',
  };

  const notifPanelStyle: React.CSSProperties = {
    ...panelBase,
    left: '50%',
    transform: notifPanelVisible ? 'translateX(-50%) scaleY(1)' : 'translateX(-50%) scaleY(0.92)',
    opacity: notifPanelVisible ? 1 : 0,
    maxHeight: 480,
    overflowY: 'auto',
  };

  const msgPanelStyle: React.CSSProperties = {
    ...panelBase,
    left: '50%',
    transform: msgPanelVisible ? 'translateX(-50%) scaleY(1)' : 'translateX(-50%) scaleY(0.92)',
    opacity: msgPanelVisible ? 1 : 0,
    maxHeight: 520,
    overflowY: 'auto',
  };

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
        <div className="max-w-2xl mx-auto lg:max-w-[1180px] flex items-center px-4 h-16 gap-2 lg:gap-3">

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
            {navItems.map(({ key, href, icon, label, badge, onClick }) => {
              const active = pathname === href || (href !== '/tareeq' && pathname.startsWith(href));
              const isPanelOpen = (key === 'notifications' && showNotifPanel) || (key === 'messages' && showMsgPanel);
              const isPanel = key === 'notifications' || key === 'messages';

              return (
                <div key={key} className="relative">
                  {isPanel ? (
                    <button
                      ref={key === 'notifications' ? notifBtnRef : msgBtnRef}
                      onClick={onClick}
                      title={label}
                      className="relative flex items-center justify-center w-24 h-12 rounded-xl transition-all hover:bg-[var(--tr-overlay)]"
                      style={{
                        color: (active || isPanelOpen) ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                        borderBottom: `3px solid ${(active || isPanelOpen) ? 'var(--tr-gold)' : 'transparent'}`,
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {icon}
                      {badge > 0 && (
                        <span className="absolute top-1.5 end-3 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-black px-0.5" style={{ background: '#f43f5e', color: '#fff' }}>
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={href}
                      title={label}
                      className="relative flex items-center justify-center w-24 h-12 rounded-xl transition-all hover:bg-[var(--tr-overlay)] group"
                      style={{
                        color: active ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                        borderBottom: `3px solid ${active ? 'var(--tr-gold)' : 'transparent'}`,
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
                  )}

                  {/* Notifications dropdown panel */}
                  {key === 'notifications' && showNotifPanel && (
                    <div ref={notifPanelRef} style={notifPanelStyle}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                        <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>
                          {isRtl ? 'الإشعارات' : 'Notifications'}
                        </span>
                        <Link
                          href="/tareeq/notifications"
                          onClick={() => setShowNotifPanel(false)}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--tr-gold)' }}
                        >
                          {isRtl ? 'عرض الكل' : 'See all'}
                        </Link>
                      </div>

                      {notifsLoading ? (
                        <div className="flex justify-center py-10">
                          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                        </div>
                      ) : notifs.filter(n => n.type !== 'message').length === 0 ? (
                        <div className="text-center py-10 px-4">
                          <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                          </svg>
                          <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
                            {isRtl ? 'لا إشعارات جديدة' : 'No new notifications'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          {notifs.filter(n => n.type !== 'message').map(n => (
                            <button
                              key={n.id}
                              onClick={() => {
                                setShowNotifPanel(false);
                                if (n.postId) router.push(`/tareeq/p/${n.postId}`);
                              }}
                              className="w-full flex items-start gap-3 px-4 py-3 text-start transition"
                              style={{
                                background: n.read ? 'transparent' : 'rgba(212,168,83,0.04)',
                                borderBottom: '1px solid var(--tr-border-subtle)',
                              }}
                            >
                              <NotifIcon type={n.type} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--tr-text-primary)' }}>
                                  {n.type === 'like' && (
                                    <>{isRtl ? `${n.actorName || 'شخص ما'} أعجب بعلامتك` : `${n.actorName || 'Someone'} liked your mark`}{n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}</>
                                  )}
                                  {n.type === 'comment' && (
                                    <>{isRtl ? `${n.actorName || 'شخص ما'} علّق على` : `${n.actorName || 'Someone'} commented on`}{n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}{n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>
                                  )}
                                  {n.type !== 'like' && n.type !== 'comment' && (
                                    <>{isRtl ? `رسالة من ${n.actorName || 'شخص ما'}` : `Message from ${n.actorName || 'Someone'}`}{n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>
                                  )}
                                </p>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(n.createdAt, isRtl)}</p>
                              </div>
                              {!n.read && <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: 'var(--tr-gold)' }} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messages popup panel */}
                  {key === 'messages' && showMsgPanel && (
                    <div ref={msgPanelRef} style={msgPanelStyle}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                        <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>
                          {isRtl ? 'الرسائل' : 'Messages'}
                        </span>
                        <Link
                          href="/tareeq/inbox"
                          onClick={() => setShowMsgPanel(false)}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--tr-gold)' }}
                        >
                          {isRtl ? 'عرض الكل' : 'See all'}
                        </Link>
                      </div>

                      {msgsLoading ? (
                        <div className="flex justify-center py-10">
                          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                        </div>
                      ) : conversations.length === 0 ? (
                        <div className="text-center py-10 px-4">
                          <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                          </svg>
                          <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
                            {isRtl ? 'لا رسائل بعد' : 'No messages yet'}
                          </p>
                          <p className="text-xs mt-1.5" style={{ color: 'var(--tr-text-muted)' }}>
                            {isRtl ? 'ابدأ محادثة من صفحة أي مستخدم' : 'Start a chat from any profile'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          {conversations.map(c => (
                            <Link
                              key={c.id}
                              href={`/tareeq/inbox/${c.id}`}
                              onClick={() => setShowMsgPanel(false)}
                              className="flex items-center gap-3 px-4 py-3 transition"
                              style={{
                                background: c.unreadCount > 0 ? 'rgba(212,168,83,0.04)' : 'transparent',
                                borderBottom: '1px solid var(--tr-border-subtle)',
                              }}
                            >
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                                {c.otherUser.avatarUrl
                                  ? <img src={c.otherUser.avatarUrl} alt={c.otherUser.name} className="w-full h-full object-cover" />
                                  : c.otherUser.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{c.otherUser.name}</p>
                                {c.lastMessage && (
                                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{c.lastMessage}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {c.lastMessageAt && (
                                  <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(c.lastMessageAt, isRtl)}</span>
                                )}
                                {c.unreadCount > 0 && (
                                  <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>
                                    {c.unreadCount}
                                  </span>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
      <div className="h-16" />
    </>
  );
}
