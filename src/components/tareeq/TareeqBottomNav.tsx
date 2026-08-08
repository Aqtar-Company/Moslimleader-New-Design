'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { setCameraFile } from '@/lib/tareeq-camera-store';

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface Notification {
  id: string; type: string; actorName?: string | null; postId?: string | null;
  postTitle?: string | null; body?: string | null; read: boolean; createdAt: string;
}

/* ─── Utils ─────────────────────────────────────────────────────────────────── */
function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return isRtl ? 'الآن' : 'now';
  if (diff < 3600) return isRtl ? `${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return isRtl ? `${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h`;
  return isRtl ? `${Math.floor(diff / 86400)} ي` : `${Math.floor(diff / 86400)}d`;
}

/* ─── SVG Curved Nav Path ───────────────────────────────────────────────────── */
// viewBox: "0 0 1000 102"
// y=0 → 40px above nav top edge; y=40 → nav top; y=102 → nav bottom
// dip goes DOWN into nav body: dipY = 40 + depth
// depth(dy=0) = 22;  depth(dy=90) ≈ 44  → dip deepens as circle rises
function buildNavPath(dy: number): string {
  const CX = 500;
  const NAV_Y = 40;
  const depth = 22 + Math.min(Math.max(dy, 0), 90) * 0.25;
  const halfSpan = 210 + Math.min(Math.max(dy, 0), 90) * 0.55;
  const dipY = NAV_Y + depth;
  const lx = CX - halfSpan;
  const rx = CX + halfSpan;
  const cf = 0.38; // control-point fraction of halfSpan
  return (
    `M 0 ${NAV_Y} ` +
    `L ${lx} ${NAV_Y} ` +
    `C ${lx + halfSpan * cf} ${NAV_Y} ${CX - 26} ${dipY} ${CX} ${dipY} ` +
    `C ${CX + 26} ${dipY} ${rx - halfSpan * cf} ${NAV_Y} ${rx} ${NAV_Y} ` +
    `L 1000 ${NAV_Y} L 1000 102 L 0 102 Z`
  );
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const NAV_H = 62;
const CIRCLE_SIZE = 56;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
// Circle center sits 6px above nav top edge: bottom_css = 62 + 6 - 28 = 40
const CIRCLE_BTN_BOTTOM = NAV_H + 6 - CIRCLE_RADIUS; // 40

const DRAG_TOL = 10;        // px before entering drag mode
const CAMERA_THRESHOLD = 68; // px upward to trigger camera
const CAM_HINT_KEY = 'tr_cam_hint_count';
const CAM_HINT_MAX = 10;

/* ─── Notification Icons ────────────────────────────────────────────────────── */
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
  if (n.type === 'comment') return (
    <span>
      {isRtl ? `${actor} علّق على ${title}` : `${actor} commented on ${title}`}
      {n.body && <span className="block text-xs mt-0.5 opacity-60 truncate">{n.body}</span>}
    </span>
  );
  return (
    <span>
      {isRtl ? `رسالة من ${actor}` : `Message from ${actor}`}
      {n.body && <span className="block text-xs mt-0.5 opacity-60 truncate">{n.body}</span>}
    </span>
  );
}

/* ─── Profile / Settings Sheet ──────────────────────────────────────────────── */
interface ProfileSheetProps {
  onClose: () => void;
  onCreateClick: () => void;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
}

function ProfileSheet({ onClose, onCreateClick, userId, userName, avatarUrl }: ProfileSheetProps) {
  const { isRtl } = useLang();
  const { signOut } = useAuth();
  const router = useRouter();
  const [notifState, setNotifState] = useState<'default' | 'granted' | 'denied'>('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifState(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default');
    }
  }, []);

  const initial = userName.charAt(0).toUpperCase();
  const shareUrl = 'https://moslimleader.com/tareeq';
  const shareText = isRtl ? 'انضم إليّ في تطبيق طريق — شارك علاماتك وانتفع بتجارب الآخرين' : 'Join me on Tareeq — share your marks and benefit from others';

  function handleLogout() {
    onClose();
    signOut();
    router.push('/tareeq');
  }

  function handleCreate() {
    onClose();
    onCreateClick();
  }

  async function handleEnableNotifs() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') return;
    const perm = await Notification.requestPermission();
    setNotifState(perm === 'granted' ? 'granted' : 'denied');
  }

  function share(platform: 'whatsapp' | 'x' | 'telegram' | 'facebook') {
    const enc = encodeURIComponent;
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${enc(shareText + ' ' + shareUrl)}`,
      x: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`,
      telegram: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`,
    };
    window.open(urls[platform], '_blank', 'noopener');
  }

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 16px', borderRadius: 16,
    background: 'var(--tr-overlay)', cursor: 'pointer',
    border: 'none', width: '100%', textAlign: 'start' as const,
  };

  const iconBox = (bg: string, border: string) => ({
    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, border: `1px solid ${border}`,
  });

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{
          background: 'var(--tr-surface)',
          borderTop: '1px solid var(--tr-border-soft)',
          boxShadow: '0 -16px 64px rgba(0,0,0,0.4)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--tr-border-strong)' }} />
        </div>

        {/* Profile header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <div style={{ flex: 1 }}>
            <p className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>{userName}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>@{userName.toLowerCase().replace(/\s+/g, '')}</p>
          </div>
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName}
              className="w-12 h-12 rounded-full object-cover"
              style={{ border: '2px solid var(--tr-gold-dim)' }} />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg"
              style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
              {initial}
            </div>
          )}
        </div>

        <div className="px-4 py-3 flex flex-col gap-2">
          {/* My Posts */}
          <Link
            href={`/tareeq/u/${userId}`}
            onClick={onClose}
            className="flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
            style={{ background: 'var(--tr-overlay)' }}
          >
            <div style={iconBox('var(--tr-overlay)', 'var(--tr-border-soft)')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'منشوراتي' : 'My Posts'}</span>
            <svg className="w-4 h-4 ms-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
            </svg>
          </Link>

          {/* Leave your mark */}
          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#0a0d06' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {isRtl ? 'اترك علامتك' : 'Leave Your Mark'}
          </button>

          {/* Share section */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--tr-overlay)' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              <span className="text-xs font-bold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'شارك طريق' : 'Share Tareeq'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {([
                { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.528 5.845L0 24l6.335-1.496A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.513-5.165-1.406L2.4 21.8l1.208-4.316A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                )},
                { key: 'x', label: 'X', color: '#000', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                )},
                { key: 'telegram', label: 'Telegram', color: '#2AABEE', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                )},
                { key: 'facebook', label: 'Facebook', color: '#1877F2', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                )},
              ] as const).map(({ key, label, color, icon }) => (
                <button
                  key={key}
                  onClick={() => share(key as 'whatsapp' | 'x' | 'telegram' | 'facebook')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                  style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                >
                  <span style={{ color }}>{icon}</span>
                  <span>{label}</span>
                  <span className="w-2 h-2 rounded-full ms-auto" style={{ background: color, opacity: 0.7 }} />
                </button>
              ))}
            </div>
          </div>

          {/* Enable Notifications */}
          <button
            onClick={handleEnableNotifs}
            style={rowStyle}
            className="transition-all active:scale-[0.98]"
          >
            <div style={iconBox('var(--tr-overlay)', 'var(--tr-border-soft)')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: notifState === 'granted' ? 'var(--tr-gold)' : 'var(--tr-text-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-bold text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'فعّل الإشعارات' : 'Enable Notifications'}</span>
              <span className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                {notifState === 'granted' ? (isRtl ? 'مفعّلة ✓' : 'Enabled ✓')
                  : notifState === 'denied' ? (isRtl ? 'محظورة من الإعدادات' : 'Blocked in browser settings')
                  : (isRtl ? 'تلقّ إشعارات على جهازك' : 'Get alerts on your device')}
              </span>
            </div>
            {notifState === 'default' && (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
              </svg>
            )}
          </button>

          {/* Moslim Leader Store */}
          <a
            href="https://moslimleader.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
            style={{ background: 'var(--tr-overlay)', textDecoration: 'none' }}
          >
            <div style={iconBox('var(--tr-overlay)', 'var(--tr-border-soft)')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-bold text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'متجر مسلم ليدر' : 'Moslim Leader'}</span>
              <span className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>moslimleader.com</span>
            </div>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>

          {/* About */}
          <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--tr-overlay)' }}>
            <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'عن طريق' : 'About Tareeq'}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl
                ? 'طريق مساحة مجتمعية لمشاركة التجارب والأفكار التي تُهدي الآخرين. وَبِالنَّجْمِ هُمْ يَهْتَدُونَ.'
                : 'Tareeq is a community space for sharing experiences and thoughts that guide others. By the star they find their way.'}
            </p>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all active:scale-[0.98] w-full"
            style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.15)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: '#f43f5e' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span className="font-bold text-sm" style={{ color: '#f43f5e' }}>{isRtl ? 'تسجيل الخروج' : 'Sign Out'}</span>
          </button>
        </div>
        {/* Bottom safe-area padding */}
        <div className="h-6" />
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
interface Props { onCreateClick: () => void }

export default function TareeqBottomNav({ onCreateClick }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { notifCount, refresh } = useTareeqNotifications();
  const pathname = usePathname();
  const router = useRouter();

  /* ── Notification panel state ────────────────────────── */
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  /* ── Profile sheet state ─────────────────────────────── */
  const [showProfile, setShowProfile] = useState(false);

  /* ── Camera ──────────────────────────────────────────── */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const count = parseInt(localStorage.getItem(CAM_HINT_KEY) ?? '0', 10);
    setShowHint(count < CAM_HINT_MAX);
  }, []);

  /* ── Gesture refs (no re-render during drag) ─────────── */
  const btnRef = useRef<HTMLButtonElement>(null);
  const svgPathRef = useRef<SVGPathElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const animRafRef = useRef<number | null>(null);

  const gesture = useRef({
    active: false, startY: 0, dy: 0,
    mode: 'idle' as 'idle' | 'tap' | 'drag',
    thresholdHit: false, pointerId: null as number | null,
  });

  /* ── Reduced motion ──────────────────────────────────── */
  const prefersReduced = useRef(false);
  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /* ── Notification loading ────────────────────────────── */
  const loadNotifs = useCallback(async () => {
    if (!user) return;
    setNotifsLoading(true);
    try {
      const res = await fetch('/api/tareeq/notifications?limit=20', { credentials: 'include' });
      if (res.ok) setNotifs((await res.json()).notifications ?? []);
      await fetch('/api/tareeq/notifications', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      }).then(() => refresh()).catch(() => {});
    } catch { /* offline */ } finally { setNotifsLoading(false); }
  }, [user, refresh]);

  useEffect(() => { if (showNotifs) loadNotifs(); }, [showNotifs, loadNotifs]);

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

  /* ── Gesture helpers ─────────────────────────────────── */
  function applyDy(dy: number) {
    const clamped = Math.min(dy, 110);
    if (btnRef.current) {
      btnRef.current.style.transform = `translateX(-50%) translateY(${-clamped}px)`;
    }
    if (svgPathRef.current) {
      svgPathRef.current.setAttribute('d', buildNavPath(clamped));
    }
    if (hintRef.current) {
      hintRef.current.style.opacity = String(Math.max(0, 1 - dy / 20));
    }
  }

  function springReturn(fromDy: number, onDone?: () => void) {
    if (prefersReduced.current) {
      applyDy(0);
      onDone?.();
      return;
    }
    // CSS spring on button
    if (btnRef.current) {
      btnRef.current.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)';
      btnRef.current.style.transform = 'translateX(-50%) translateY(0px)';
    }
    if (hintRef.current) {
      hintRef.current.style.opacity = '1';
    }
    // RAF interpolation for SVG path
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    const start = performance.now();
    const dur = 420;
    function step(now: number) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      if (svgPathRef.current) svgPathRef.current.setAttribute('d', buildNavPath(fromDy * (1 - ease)));
      if (t < 1) animRafRef.current = requestAnimationFrame(step);
      else { animRafRef.current = null; onDone?.(); }
    }
    animRafRef.current = requestAnimationFrame(step);
  }

  function playTapAnim() {
    const btn = btnRef.current;
    if (!btn || prefersReduced.current) return;
    btn.style.transition = 'transform 0.07s ease-in';
    btn.style.transform = 'translateX(-50%) scale(0.94)';
    setTimeout(() => {
      btn.style.transition = 'transform 0.12s ease-out';
      btn.style.transform = 'translateX(-50%) scale(1.03)';
    }, 75);
    setTimeout(() => {
      btn.style.transition = 'transform 0.10s ease-in-out';
      btn.style.transform = 'translateX(-50%) scale(1)';
    }, 190);
  }

  /* ── Pointer handlers ────────────────────────────────── */
  function onBtnPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (animRafRef.current) { cancelAnimationFrame(animRafRef.current); animRafRef.current = null; }
    if (btnRef.current) {
      btnRef.current.style.transition = 'none';
      btnRef.current.style.transform = 'translateX(-50%) translateY(0px)';
    }
    if (svgPathRef.current) svgPathRef.current.setAttribute('d', buildNavPath(0));
    const g = gesture.current;
    g.active = true; g.startY = e.clientY; g.dy = 0;
    g.mode = 'idle'; g.thresholdHit = false; g.pointerId = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onBtnPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g.active || g.pointerId !== e.pointerId) return;
    const dy = Math.max(g.startY - e.clientY, 0);
    g.dy = dy;
    if (g.mode === 'idle' && dy >= DRAG_TOL) g.mode = 'drag';
    if (g.mode === 'drag') {
      applyDy(dy);
      if (!g.thresholdHit && dy >= CAMERA_THRESHOLD) {
        g.thresholdHit = true;
        if (navigator.vibrate) navigator.vibrate(12);
        // Pulse glow on threshold
        if (btnRef.current) {
          btnRef.current.style.boxShadow = '0 0 28px rgba(255,255,255,0.45), 0 4px 14px rgba(0,0,0,0.2)';
        }
      }
    }
  }

  function onBtnPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g.active || g.pointerId !== e.pointerId) return;
    g.active = false; g.pointerId = null;
    const { mode, dy } = g;
    g.mode = 'idle';
    // Reset glow
    if (btnRef.current) btnRef.current.style.boxShadow = '';

    if (mode !== 'drag') {
      // TAP → animate + create post
      playTapAnim();
      if (navigator.vibrate) navigator.vibrate(8);
      onCreateClick();
    } else if (dy >= CAMERA_THRESHOLD) {
      // SWIPE SUCCESS → camera
      const peakDy = Math.min(dy + 14, 124);
      if (btnRef.current) {
        btnRef.current.style.transition = 'transform 0.14s ease-out';
        btnRef.current.style.transform = `translateX(-50%) translateY(${-peakDy}px)`;
      }
      setTimeout(() => {
        springReturn(peakDy, () => {
          const count = parseInt(localStorage.getItem(CAM_HINT_KEY) ?? '0', 10) + 1;
          localStorage.setItem(CAM_HINT_KEY, String(count));
          if (count >= CAM_HINT_MAX) setShowHint(false);
          cameraInputRef.current?.click();
        });
      }, 150);
    } else {
      // FAILED SWIPE → spring back, no action
      springReturn(Math.min(dy, 110));
    }
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { setCameraFile(file); onCreateClick(); }
    e.target.value = '';
  }

  const isHome = pathname === '/tareeq' || pathname === '/tareeq/';
  const isInbox = pathname.startsWith('/tareeq/inbox');
  const isOnProfile = pathname.startsWith('/tareeq/u/') || pathname === '/tareeq/profile';

  return (
    <>
      {/* Hidden camera input */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        className="sr-only" onChange={onCameraChange} />

      {/* ── Profile sheet ─────────────────────────────────── */}
      {showProfile && user && (
        <ProfileSheet
          onClose={() => setShowProfile(false)}
          onCreateClick={onCreateClick}
          userId={user.id}
          userName={user.name ?? ''}
          avatarUrl={user.avatarUrl}
        />
      )}

      {/* ── Floating notification bell ─────────────────────── */}
      <div className="fixed z-50 print:hidden" style={{ top: 14, [isRtl ? 'left' : 'right']: 14 }}>
        <button
          ref={bellRef}
          onClick={() => setShowNotifs(v => !v)}
          aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
          className="relative w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{
            background: showNotifs ? 'var(--tr-gold-glow)' : 'color-mix(in srgb, var(--tr-surface) 88%, transparent)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: showNotifs ? '1px solid var(--tr-gold-dim)' : '1px solid var(--tr-border-soft)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
          <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
            style={{ color: showNotifs ? 'var(--tr-gold)' : 'var(--tr-text-secondary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-black px-0.5"
              style={{ background: '#f43f5e', color: '#fff' }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* ── Glass notification panel ───────────────────── */}
        {showNotifs && (
          <div
            ref={notifPanelRef}
            className="absolute mt-2 flex flex-col overflow-hidden"
            style={{
              top: '100%',
              [isRtl ? 'left' : 'right']: 0,
              width: 'min(340px, calc(100vw - 28px))',
              maxHeight: '65vh',
              borderRadius: 20,
              background: 'color-mix(in srgb, var(--tr-surface) 88%, transparent)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid var(--tr-border-soft)',
              boxShadow: '0 16px 56px rgba(0,0,0,0.28)',
            }}
          >
            {/* Panel header */}
            <div className="px-4 py-3 flex items-center justify-between shrink-0"
              style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>
                {isRtl ? 'الإشعارات' : 'Notifications'}
              </span>
              <Link href="/tareeq/notifications" onClick={() => setShowNotifs(false)}
                className="text-[11px] font-bold px-3 py-1 rounded-full"
                style={{ color: 'var(--tr-gold)', background: 'var(--tr-gold-glow)' }}>
                {isRtl ? 'الكل' : 'See all'}
              </Link>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1">
              {notifsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                </div>
              ) : notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
                    {isRtl ? 'لا إشعارات' : 'No notifications'}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {notifs.map((n, i) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className="w-full text-start px-4 py-3 flex items-start gap-3 transition-all active:scale-[0.98]"
                      style={{
                        background: n.read ? 'transparent' : 'var(--tr-gold-glow)',
                        borderBottom: i < notifs.length - 1 ? '1px solid var(--tr-border-subtle)' : 'none',
                      }}
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
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
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Center circle button (fixed, above nav) ───────── */}
      <button
        ref={btnRef}
        onPointerDown={onBtnPointerDown}
        onPointerMove={onBtnPointerMove}
        onPointerUp={onBtnPointerUp}
        onPointerCancel={() => {
          const g = gesture.current;
          if (!g.active) return;
          g.active = false; g.pointerId = null; g.mode = 'idle';
          if (btnRef.current) btnRef.current.style.boxShadow = '';
          springReturn(Math.min(g.dy, 110));
        }}
        aria-label={isRtl ? 'نشر علامة' : 'Post mark'}
        className="select-none touch-none"
        style={{
          position: 'fixed',
          bottom: `calc(${CIRCLE_BTN_BOTTOM}px + env(safe-area-inset-bottom, 0px))`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: '50%',
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)',
          zIndex: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          willChange: 'transform',
          cursor: 'pointer',
        }}
      >
        {/* Pen/edit icon */}
        <svg width="22" height="22" fill="none" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487z" />
        </svg>

        {/* Swipe-up hint */}
        {showHint && (
          <div
            ref={hintRef}
            className="absolute pointer-events-none flex flex-col items-center"
            style={{ bottom: '110%', marginBottom: 4 }}
          >
            <span style={{ fontSize: 10, color: 'var(--tr-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {isRtl ? '↑ اسحب للكاميرا' : '↑ swipe for camera'}
            </span>
            <style>{`
              @keyframes hintBob { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-3px); } }
            `}</style>
            <div style={{ animation: 'hintBob 2s ease-in-out infinite' }}>
              <svg width="8" height="8" viewBox="0 0 8 8" style={{ color: 'var(--tr-text-muted)', marginTop: 2 }}>
                <polygon points="4,1 7,7 1,7" fill="currentColor" />
              </svg>
            </div>
          </div>
        )}
      </button>

      {/* ── Bottom nav bar ────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 print:hidden"
        style={{ height: NAV_H, overflow: 'visible' }}
      >
        {/* SVG curved background */}
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            top: -40,
            left: 0,
            right: 0,
            width: '100%',
            height: 102,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
          preserveAspectRatio="none"
          viewBox="0 0 1000 102"
        >
          <path
            ref={svgPathRef}
            d={buildNavPath(0)}
            fill="var(--tr-surface)"
            stroke="var(--tr-border-subtle)"
            strokeWidth="1"
          />
        </svg>

        {/* Nav items */}
        <div
          dir="rtl"
          className="relative flex items-end justify-around px-3"
          style={{ height: NAV_H, paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 1 }}
        >
          {/* 1 — Profile avatar */}
          <Link
            href={user ? `/tareeq/u/${user.id}` : '/login?next=/tareeq'}
            className="flex flex-col items-center justify-end gap-1 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44 }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name ?? ''}
                className="w-7 h-7 rounded-full object-cover"
                style={{ border: '2px solid var(--tr-gold-dim)', opacity: isOnProfile ? 1 : 0.55 }} />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{
                  background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)',
                  border: '2px solid var(--tr-gold-dim)', opacity: isOnProfile ? 1 : 0.55,
                }}>
                {user?.name?.charAt(0) ?? '?'}
              </div>
            )}
          </Link>

          {/* 2 — انتفع (Sparkles) */}
          <Link
            href="/tareeq"
            className="flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44 }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
              style={{
                color: isHome ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                filter: isHome ? 'drop-shadow(0 0 5px rgba(212,168,83,0.45))' : 'none',
                transition: 'all 0.2s',
              }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, color: isHome ? 'var(--tr-gold)' : 'var(--tr-text-muted)', transition: 'color 0.2s' }}>
              {isRtl ? 'انتفع' : 'Home'}
            </span>
          </Link>

          {/* 3 — Center spacer (circle button floats above) */}
          <div style={{ width: CIRCLE_SIZE, minWidth: CIRCLE_SIZE, height: 1 }} aria-hidden />

          {/* 4 — Messages */}
          <Link
            href="/tareeq/inbox"
            className="relative flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44 }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
              style={{
                color: isInbox ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                filter: isInbox ? 'drop-shadow(0 0 5px rgba(212,168,83,0.45))' : 'none',
                transition: 'all 0.2s',
              }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </Link>

          {/* 5 — Settings gear → opens profile sheet */}
          <button
            onClick={() => { if (user) setShowProfile(true); else router.push('/login?next=/tareeq'); }}
            className="flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
              style={{
                color: isOnProfile ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                filter: isOnProfile ? 'drop-shadow(0 0 5px rgba(212,168,83,0.45))' : 'none',
                transition: 'all 0.2s',
              }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Safe-area spacer */}
      <div className="h-[calc(62px+env(safe-area-inset-bottom,0px))] shrink-0 pointer-events-none" aria-hidden />
    </>
  );
}
