'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { TareeqNotificationsProvider, useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { useAuth } from '@/context/AuthContext';
import TareeqBottomNav from './TareeqBottomNav';
import TareeqOfflineBanner from './TareeqOfflineBanner';
import TareeqQueueBanner from './TareeqQueueBanner';
import TareeqSplash from './TareeqSplash';
import TareeqIncomingCall from './TareeqIncomingCall';
import { TareeqSatisfactionGate } from './TareeqSatisfactionMode';
import { prewireInRingPipeline } from '@/lib/tareeq-ring-pipeline';

/* ── Desktop left nav — shown on all Tareeq pages except the main feed
   (which already has its own 3-column layout with an embedded left sidebar) ── */
function DesktopNav({ onCreateClick }: { onCreateClick: () => void }) {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();
  const { notifCount, messageCount } = useTareeqNotifications();

  const isHome   = pathname === '/tareeq' || pathname === '/tareeq/';
  const isInbox  = pathname.startsWith('/tareeq/inbox');
  const isNotif  = pathname.startsWith('/tareeq/notifications');
  const isProfile = pathname.startsWith('/tareeq/u/') || pathname === '/tareeq/profile';
  const isSaved  = pathname.startsWith('/tareeq/saved');

  const item = (
    href: string,
    active: boolean,
    icon: React.ReactNode,
    label: string,
    badge?: number,
  ) => (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all group"
      style={{
        background: active ? 'var(--tr-gold-glow)' : 'transparent',
        color: active ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
        fontWeight: active ? 700 : 500,
        textDecoration: 'none',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ color: active ? 'var(--tr-gold)' : 'var(--tr-text-secondary)', position: 'relative', flexShrink: 0 }}>
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1 -end-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-black px-0.5"
            style={{ background: '#f43f5e', color: '#fff' }}>
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span className="text-sm leading-none">{label}</span>
    </Link>
  );

  return (
    <aside
      className="hidden lg:flex flex-col gap-1 px-3 py-4 sticky top-0 h-screen overflow-y-auto shrink-0"
      style={{
        width: 240,
        borderInlineEnd: '1px solid var(--tr-border-subtle)',
        background: 'var(--tr-surface)',
        scrollbarWidth: 'none',
      }}
    >
      {/* Logo / brand */}
      <Link href="/tareeq" className="flex items-center gap-2.5 px-4 pb-4 mb-1" style={{ textDecoration: 'none' }}>
        <img src="/Tareeq-big.png" alt="طريق" className="w-9 h-9 rounded-xl object-cover" style={{ border: '1px solid var(--tr-border-soft)' }} />
        <span className="font-black text-base" style={{ color: 'var(--tr-gold)', letterSpacing: '0.03em' }}>طريق</span>
      </Link>

      {/* Nav links */}
      {item('/tareeq', isHome,
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>,
        'الرئيسية'
      )}
      {item('/tareeq/inbox', isInbox,
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
        'الرسائل',
        messageCount,
      )}
      {item('/tareeq/notifications', isNotif,
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
        'الإشعارات',
        notifCount,
      )}
      {user && item(`/tareeq/u/${user.id}`, isProfile,
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
        'ملفي',
      )}
      {user && item('/tareeq/saved', isSaved,
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>,
        'المحفوظات',
      )}
      {item('/tareeq/offline', pathname.startsWith('/tareeq/offline'),
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>,
        'بدون إنترنت',
      )}
      {user && item('/tareeq/export', pathname.startsWith('/tareeq/export'),
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>,
        'تصدير البيانات',
      )}

      {item('/tareeq/khatmati', pathname.startsWith('/tareeq/khatmati'),
        <img src="/nori lamp icon.svg" width={20} height={20} alt="" style={{ opacity: pathname.startsWith('/tareeq/khatmati') ? 1 : 0.6 }} />,
        'نوري',
      )}

      {/* Divider */}
      <div className="mx-4 my-2" style={{ height: 1, background: 'var(--tr-border-subtle)' }} />

      {/* Post button */}
      <button
        onClick={onCreateClick}
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#0a0d06', border: 'none', cursor: 'pointer' }}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        اترك علامتك
      </button>

      {/* User avatar at bottom */}
      {user && (
        <Link href={`/tareeq/u/${user.id}`} className="flex items-center gap-3 px-4 py-3 rounded-2xl mt-auto transition-all"
          style={{ textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name ?? ''} className="w-8 h-8 rounded-full object-cover shrink-0"
              style={{ border: '2px solid var(--tr-gold-dim)' }} />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0"
              style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
              {user.name?.charAt(0) ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--tr-text-primary)' }}>{user.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>عرض الملف</p>
          </div>
        </Link>
      )}
    </aside>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  function handleCreateClick() {
    if (pathname === '/tareeq') {
      window.dispatchEvent(new Event('tareeq-open-create'));
    } else {
      router.push('/tareeq?action=create');
    }
  }

  useEffect(() => {
    prewireInRingPipeline();
    const onGesture = () => prewireInRingPipeline();
    document.addEventListener('touchstart', onGesture, { passive: true });
    document.addEventListener('click', onGesture);
    return () => {
      document.removeEventListener('touchstart', onGesture);
      document.removeEventListener('click', onGesture);
    };
  }, []);

  useEffect(() => {
    const h = () => {
      if (pathname !== '/tareeq') router.push('/tareeq');
    };
    window.addEventListener('tareeq-camera-ready', h);
    return () => window.removeEventListener('tareeq-camera-ready', h);
  }, [pathname, router]);

  // Only the READ page is fully immersive — home + other khatmati pages keep the nav
  const isKhatmatiRead = pathname.startsWith('/tareeq/khatmati/read');
  const hideNav = /^\/tareeq\/inbox\/.+/.test(pathname) || /^\/tareeq\/groups\/.+/.test(pathname) || isKhatmatiRead;
  // Main feed already has its own 3-column grid with embedded left nav — skip the shared sidebar there
  const isMainFeed = pathname === '/tareeq' || pathname === '/tareeq/';

  return (
    <>
      <TareeqSplash />
      <TareeqOfflineBanner />
      <TareeqQueueBanner />

      {/* Layout: on desktop (non-main-feed), wrap in flex to show the nav sidebar */}
      {isMainFeed ? (
        <div className="relative pb-[60px] sm:pb-0">{children}</div>
      ) : (
        <div className="flex min-h-screen" dir="rtl">
          {!isKhatmatiRead && <DesktopNav onCreateClick={handleCreateClick} />}
          <div className={`flex-1 min-w-0 ${isKhatmatiRead ? '' : 'pb-[60px] sm:pb-0'}`} dir="rtl">{children}</div>
        </div>
      )}

      {!hideNav && <div className="lg:hidden"><TareeqBottomNav onCreateClick={handleCreateClick} /></div>}
      <TareeqSatisfactionGate />
      <TareeqIncomingCall />
    </>
  );
}

export default function TareeqShell({ children }: { children: React.ReactNode }) {
  return (
    <TareeqNotificationsProvider>
      <ShellInner>{children}</ShellInner>
    </TareeqNotificationsProvider>
  );
}
