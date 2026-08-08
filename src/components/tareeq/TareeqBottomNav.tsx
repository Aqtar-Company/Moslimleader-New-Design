'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { setCameraFile } from '@/lib/tareeq-camera-store';

interface Notification {
  id: string;
  type: string;
  actorName?: string | null;
  postId?: string | null;
  postTitle?: string | null;
  body?: string | null;
  read: boolean;
  createdAt: string;
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
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#f43f5e' }}>
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );
  if (type === 'comment') return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-teal)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function NotifText({ n, isRtl }: { n: Notification; isRtl: boolean }) {
  const actor = n.actorName || (isRtl ? 'شخص ما' : 'Someone');
  const title = n.postTitle ? `«${n.postTitle}»` : '';
  if (n.type === 'like') return <span>{isRtl ? `${actor} أعجب بعلامتك ${title}` : `${actor} liked your mark ${title}`}</span>;
  if (n.type === 'comment') return <span>{isRtl ? `${actor} علّق على ${title}` : `${actor} commented on ${title}`}{n.body && <span className="block text-xs mt-0.5 opacity-60 truncate">{n.body}</span>}</span>;
  return <span>{isRtl ? `رسالة من ${actor}` : `Message from ${actor}`}{n.body && <span className="block text-xs mt-0.5 opacity-60 truncate">{n.body}</span>}</span>;
}

// localStorage key tracking camera-hint display count
const CAM_HINT_KEY = 'tr_cam_hint_count';
const CAM_HINT_MAX = 10;
const SWIPE_THRESHOLD = 44; // px upward to trigger camera

interface Props {
  onCreateClick: () => void;
}

export default function TareeqBottomNav({ onCreateClick }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { notifCount, refresh } = useTareeqNotifications();
  const pathname = usePathname();
  const router = useRouter();

  // Notification panel
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Post button swipe-to-camera
  const [showHint, setShowHint] = useState(false);
  const [swipeDelta, setSwipeDelta] = useState(0); // positive = swiped up
  const [swipeActive, setSwipeActive] = useState(false);
  const swipeStartY = useRef(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const count = parseInt(localStorage.getItem(CAM_HINT_KEY) ?? '0', 10);
    setShowHint(count < CAM_HINT_MAX);
  }, []);

  // Fetch notifications when panel opens
  const loadNotifs = useCallback(async () => {
    if (!user) return;
    setNotifsLoading(true);
    try {
      const res = await fetch('/api/tareeq/notifications?limit=20', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setNotifs(d.notifications ?? []);
      }
      // Mark read
      await fetch('/api/tareeq/notifications', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      }).then(() => refresh()).catch(() => {});
    } catch { /* offline */ } finally { setNotifsLoading(false); }
  }, [user, refresh]);

  useEffect(() => {
    if (showNotifs) loadNotifs();
  }, [showNotifs, loadNotifs]);

  // Close panel on outside click
  useEffect(() => {
    if (!showNotifs) return;
    function handle(e: MouseEvent | TouchEvent) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
          bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('touchstart', handle); };
  }, [showNotifs]);

  function handleNotifClick(n: Notification) {
    setShowNotifs(false);
    if (n.type === 'message' && n.postId) router.push(`/tareeq/inbox/${n.postId}`);
    else if (n.type === 'message') router.push('/tareeq/inbox');
    else if (n.postId) router.push(`/tareeq/${n.postId}`);
  }

  // Swipe handlers for the post button
  function onPostPointerDown(e: React.PointerEvent) {
    pointerIdRef.current = e.pointerId;
    swipeStartY.current = e.clientY;
    setSwipeActive(true);
    setSwipeDelta(0);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPostPointerMove(e: React.PointerEvent) {
    if (!swipeActive || pointerIdRef.current !== e.pointerId) return;
    const delta = swipeStartY.current - e.clientY; // positive = up
    setSwipeDelta(delta > 0 ? delta : 0);
  }

  function onPostPointerUp(e: React.PointerEvent) {
    if (!swipeActive || pointerIdRef.current !== e.pointerId) return;
    const delta = swipeStartY.current - e.clientY;
    setSwipeActive(false);
    setSwipeDelta(0);
    pointerIdRef.current = null;

    if (delta >= SWIPE_THRESHOLD) {
      // Trigger camera
      const count = parseInt(localStorage.getItem(CAM_HINT_KEY) ?? '0', 10) + 1;
      localStorage.setItem(CAM_HINT_KEY, String(count));
      if (count >= CAM_HINT_MAX) setShowHint(false);
      cameraInputRef.current?.click();
    } else {
      // Normal tap → open create modal
      onCreateClick();
    }
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCameraFile(file);
      onCreateClick(); // open create modal which will pick up the file
    }
    e.target.value = '';
  }

  const isHome = pathname === '/tareeq' || pathname === '/tareeq/';
  const isInbox = pathname.startsWith('/tareeq/inbox');

  const navStyle = {
    background: 'rgba(7,13,20,0.94)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  };

  // Post button: shows swipe-up visual feedback
  const swipePct = Math.min(swipeDelta / SWIPE_THRESHOLD, 1);
  const postBtnScale = swipeActive && swipeDelta > 8 ? 1 + swipePct * 0.12 : 1;
  const postBtnGlow = swipeActive && swipeDelta > 8 ? `0 0 ${24 + swipePct * 32}px rgba(212,168,83,${0.35 + swipePct * 0.3})` : '0 4px 18px rgba(212,168,83,0.28)';

  return (
    <>
      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onCameraChange}
      />

      {/* ─── Floating notification bell (top-right, no header) ─── */}
      <div className="fixed z-50 print:hidden" style={{ top: 14, [isRtl ? 'left' : 'right']: 14 }}>
        <button
          ref={bellRef}
          onClick={() => setShowNotifs(v => !v)}
          aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
          className="relative w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            background: showNotifs ? 'rgba(212,168,83,0.18)' : 'rgba(13,26,38,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: showNotifs ? '1px solid rgba(212,168,83,0.35)' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: showNotifs ? 'var(--tr-gold)' : 'rgba(255,255,255,0.7)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {notifCount > 0 && (
            <span
              className="absolute -top-0.5 -end-0.5 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-black px-0.5"
              style={{ background: '#f43f5e', color: '#fff' }}
            >
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* Glass notification panel */}
        {showNotifs && (
          <div
            ref={notifPanelRef}
            className="absolute mt-2 overflow-y-auto flex flex-col"
            style={{
              top: '100%',
              [isRtl ? 'left' : 'right']: 0,
              width: 'min(340px, calc(100vw - 28px))',
              maxHeight: '65vh',
              gap: 6,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Panel header */}
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(13,26,38,0.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>
                {isRtl ? 'الإشعارات' : 'Notifications'}
              </span>
              <Link
                href="/tareeq/notifications"
                onClick={() => setShowNotifs(false)}
                className="text-[11px] font-semibold"
                style={{ color: 'var(--tr-gold)' }}
              >
                {isRtl ? 'الكل' : 'See all'}
              </Link>
            </div>

            {/* Notification cards */}
            {notifsLoading ? (
              <div
                className="rounded-2xl flex items-center justify-center py-6"
                style={{ background: 'rgba(13,26,38,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
              </div>
            ) : notifs.length === 0 ? (
              <div
                className="rounded-2xl flex items-center justify-center py-8 text-sm"
                style={{ background: 'rgba(13,26,38,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--tr-text-muted)' }}
              >
                {isRtl ? 'لا إشعارات' : 'No notifications'}
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className="w-full text-start rounded-2xl px-4 py-3 flex items-start gap-3 transition-all active:scale-[0.98]"
                  style={{
                    background: n.read ? 'rgba(13,26,38,0.92)' : 'rgba(20,32,48,0.96)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: n.read ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(212,168,83,0.22)',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug" style={{ color: 'var(--tr-text-primary)' }} dir="auto">
                      <NotifText n={n} isRtl={isRtl} />
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(n.createdAt, isRtl)}</p>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--tr-gold)' }} />}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ─── Bottom navigation bar ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 print:hidden" style={navStyle}>
        <div
          className="max-w-lg mx-auto flex items-end justify-around px-4"
          style={{ height: 62, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          dir="rtl"
        >
          {/* 1 — Profile (rightmost in RTL) */}
          <Link
            href="/tareeq/profile"
            className="flex flex-col items-center justify-end gap-1 pb-2 transition-opacity active:opacity-60"
            style={{ minWidth: 44 }}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? ''}
                className="w-7 h-7 rounded-full object-cover"
                style={{ border: '2px solid var(--tr-gold-dim)', opacity: pathname.startsWith('/tareeq/profile') || pathname.startsWith('/tareeq/u/') ? 1 : 0.55 }}
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{
                  background: 'var(--tr-gold-glow)',
                  color: 'var(--tr-gold)',
                  border: '2px solid var(--tr-gold-dim)',
                  opacity: pathname.startsWith('/tareeq/profile') || pathname.startsWith('/tareeq/u/') ? 1 : 0.55,
                }}
              >
                {user?.name?.charAt(0) ?? '?'}
              </div>
            )}
          </Link>

          {/* 2 — انتفع (Home) */}
          <Link
            href="/tareeq"
            className="flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44 }}
          >
            <span style={{
              fontSize: 22, lineHeight: 1,
              color: isHome ? 'var(--tr-gold)' : 'rgba(255,255,255,0.4)',
              filter: isHome ? 'drop-shadow(0 0 6px rgba(212,168,83,0.5))' : 'none',
              transition: 'all 0.2s',
            }}>
              ۞
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, lineHeight: 1,
              color: isHome ? 'var(--tr-gold)' : 'rgba(255,255,255,0.3)',
              transition: 'color 0.2s',
            }}>
              {isRtl ? 'انتفع' : 'Home'}
            </span>
          </Link>

          {/* 3 — Post button (center, elevated) */}
          <div className="relative flex flex-col items-center" style={{ marginBottom: 8 }}>
            {/* Swipe-up hint */}
            {showHint && !swipeActive && (
              <div
                className="absolute flex flex-col items-center pointer-events-none"
                style={{ bottom: '100%', marginBottom: 6, animation: 'hintFloat 2s ease-in-out infinite' }}
              >
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  {isRtl ? 'اسحب ↑ للكاميرا' : 'Swipe ↑ camera'}
                </span>
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
                  <path d="M5 2l3.5 5h-7z" fill="currentColor" transform="rotate(180 5 5)" />
                </svg>
              </div>
            )}

            {/* Swipe indicator bar */}
            {swipeActive && swipeDelta > 8 && (
              <div className="absolute pointer-events-none" style={{ bottom: '110%', width: 3, borderRadius: 2, background: `rgba(212,168,83,${0.3 + swipePct * 0.7})`, height: Math.min(swipeDelta * 0.6, 40), transition: 'none' }} />
            )}

            <button
              onPointerDown={onPostPointerDown}
              onPointerMove={onPostPointerMove}
              onPointerUp={onPostPointerUp}
              onPointerCancel={() => { setSwipeActive(false); setSwipeDelta(0); pointerIdRef.current = null; }}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-transform select-none touch-none"
              style={{
                background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))',
                boxShadow: postBtnGlow,
                transform: `scale(${postBtnScale})`,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              aria-label={isRtl ? 'نشر علامة' : 'Post mark'}
            >
              <span style={{ fontSize: swipeActive && swipeDelta > 8 ? 28 : 24, lineHeight: 1, color: '#0a0d06', transition: 'font-size 0.1s' }}>
                ✵
              </span>
            </button>

            <style>{`
              @keyframes hintFloat {
                0%,100%{ transform:translateY(0); opacity:.7; }
                50%     { transform:translateY(-4px); opacity:1; }
              }
            `}</style>
          </div>

          {/* 4 — Messages / Inbox */}
          <Link
            href="/tareeq/inbox"
            className="relative flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44 }}
          >
            <svg
              className="w-6 h-6"
              fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
              style={{ color: isInbox ? 'var(--tr-gold)' : 'rgba(255,255,255,0.4)', filter: isInbox ? 'drop-shadow(0 0 5px rgba(212,168,83,0.45))' : 'none', transition: 'all 0.2s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </Link>

          {/* 5 — Settings (leftmost in RTL) */}
          <Link
            href="/tareeq/profile"
            className="flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44 }}
          >
            <svg
              className="w-6 h-6"
              fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
              style={{ color: 'rgba(255,255,255,0.38)', transition: 'color 0.2s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </nav>

      {/* Safe-area bottom spacer (used by scrollable pages) */}
      <div className="h-[calc(62px+env(safe-area-inset-bottom,0px))] shrink-0 pointer-events-none" aria-hidden />
    </>
  );
}
