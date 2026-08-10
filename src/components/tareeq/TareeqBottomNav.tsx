'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { setCameraFile } from '@/lib/tareeq-camera-store';
import TareeqCallScreen, { CallParty } from './TareeqCallScreen';

/* ─── Nav color ─────────────────────────────────────────────────────────────── */
const NAV_ACCENT = '#FFCC00'; // yellow 100 + magenta ~20% — slightly warm, not orange

/* ─── SVG Curved Nav Path ───────────────────────────────────────────────────── */
// viewBox: "0 0 1000 102"
// y=0 → 40px above nav top edge; y=40 → nav top; y=102 → nav bottom
// dip goes DOWN into nav body: dipY = 40 + depth
// depth(dy=0) = 22;  depth(dy=90) ≈ 44  → dip deepens as circle rises
function buildNavPath(dy: number): string {
  const CX = 500;
  const NAV_Y = 40;
  const depth = 17 + Math.min(Math.max(dy, 0), 90) * 0.20;
  const halfSpan = 238 + Math.min(Math.max(dy, 0), 90) * 0.50;
  const dipY = NAV_Y + depth;
  const lx = CX - halfSpan;
  const rx = CX + halfSpan;
  const cf = 0.42;
  return (
    `M 0 ${NAV_Y} ` +
    `L ${lx} ${NAV_Y} ` +
    `C ${lx + halfSpan * cf} ${NAV_Y} ${CX - 26} ${dipY} ${CX} ${dipY} ` +
    `C ${CX + 26} ${dipY} ${rx - halfSpan * cf} ${NAV_Y} ${rx} ${NAV_Y} ` +
    `L 1000 ${NAV_Y} L 1000 102 L 0 102 Z`
  );
}

// Stroke-only path (top curve) — no bottom line
function buildNavStrokePath(dy: number): string {
  const CX = 500;
  const NAV_Y = 40;
  const depth = 17 + Math.min(Math.max(dy, 0), 90) * 0.20;
  const halfSpan = 238 + Math.min(Math.max(dy, 0), 90) * 0.50;
  const dipY = NAV_Y + depth;
  const lx = CX - halfSpan;
  const rx = CX + halfSpan;
  const cf = 0.42;
  return (
    `M 0 ${NAV_Y} ` +
    `L ${lx} ${NAV_Y} ` +
    `C ${lx + halfSpan * cf} ${NAV_Y} ${CX - 26} ${dipY} ${CX} ${dipY} ` +
    `C ${CX + 26} ${dipY} ${rx - halfSpan * cf} ${NAV_Y} ${rx} ${NAV_Y} ` +
    `L 1000 ${NAV_Y}`
  );
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const NAV_H = 62;
const CIRCLE_SIZE = 72;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
// Circle center sits 6px above nav top edge: bottom_css = 62 + 6 - 32 = 36
const CIRCLE_BTN_BOTTOM = NAV_H + 6 - CIRCLE_RADIUS; // 36

const DRAG_TOL = 10;        // px before entering drag mode
const CAMERA_THRESHOLD = 68; // px upward to trigger camera
const CAM_HINT_KEY = 'tr_cam_hint_count';
const CAM_HINT_MAX = 10;


/* ─── Contacts / Call Sheet ─────────────────────────────────────────────── */
interface ContactsSheetProps {
  onClose: () => void;
  onStartCall: (contact: CallParty, type: 'audio' | 'video') => void;
}

function ContactsSheet({ onClose, onStartCall }: ContactsSheetProps) {
  const { isRtl } = useLang();
  const [contacts, setContacts] = useState<CallParty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tareeq/conversations', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { conversations: [] })
      .then(d => {
        const list: CallParty[] = (d.conversations ?? []).map((c: { otherUser: { id: string; name: string; avatarUrl?: string | null } }) => ({
          id: c.otherUser.id,
          name: c.otherUser.name,
          avatarUrl: c.otherUser.avatarUrl,
        }));
        setContacts(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--tr-border-strong)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <p className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'اتصال سريع' : 'Quick Call'}
          </p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black"
            style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>✕</button>
        </div>

        {/* List */}
        <div className="px-3 py-3 flex flex-col gap-2">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
            </div>
          )}
          {!loading && contacts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'لا توجد محادثات بعد' : 'No conversations yet'}
              </p>
            </div>
          )}
          {contacts.map(c => (
            <div key={c.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
              style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-subtle)' }}
            >
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt={c.name} className="w-10 h-10 rounded-full object-cover shrink-0"
                  style={{ border: '2px solid var(--tr-border-soft)' }} />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0"
                  style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)', fontSize: 16 }}>
                  {c.name.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--tr-text-primary)' }}>{c.name}</span>
              {/* Audio call only — video call disabled */}
              <button
                onClick={() => { onStartCall(c, 'audio'); }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
                aria-label={isRtl ? 'مكالمة صوتية' : 'Voice call'}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#22c55e' }}>
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02L6.62 10.79z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="h-6" />
      </div>
    </div>
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
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifState(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default');
    }
    const saved = localStorage.getItem('tareeq-theme');
    setThemeMode(saved === 'dark' ? 'dark' : 'light');
  }, []);

  function applyTheme(mode: 'dark' | 'light') {
    setThemeMode(mode);
    localStorage.setItem('tareeq-theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }

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

          {/* Section: Account */}
          <p className="text-[10px] font-bold px-1 pt-1" style={{ color: 'var(--tr-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRtl ? 'الحساب' : 'Account'}
          </p>
          <div className="rounded-2xl overflow-hidden flex flex-col gap-px" style={{ background: 'var(--tr-overlay)' }}>
            {/* My Posts */}
            <Link
              href={`/tareeq/u/${userId}`}
              onClick={onClose}
              className="flex items-center gap-3.5 px-4 py-3 transition-all active:scale-[0.98]"
              style={{ textDecoration: 'none' }}
            >
              <div style={iconBox('var(--tr-overlay)', 'var(--tr-border-soft)')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              </div>
              <span className="font-bold text-sm flex-1" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'منشوراتي' : 'My Posts'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
              </svg>
            </Link>
            {/* Divider */}
            <div style={{ height: 1, background: 'var(--tr-border-subtle)', marginInline: 16 }} />
            {/* Edit Profile */}
            <Link
              href="/account"
              onClick={onClose}
              className="flex items-center gap-3.5 px-4 py-3 transition-all active:scale-[0.98]"
              style={{ textDecoration: 'none' }}
            >
              <div style={iconBox('var(--tr-overlay)', 'var(--tr-border-soft)')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487z" />
                </svg>
              </div>
              <span className="font-bold text-sm flex-1" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'تعديل الملف الشخصي' : 'Edit Profile'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15.75 19.5L8.25 12l7.5-7.5' : 'M8.25 4.5l7.5 7.5-7.5 7.5'} />
              </svg>
            </Link>
          </div>

          {/* Section: Notifications */}
          <p className="text-[10px] font-bold px-1 pt-1" style={{ color: 'var(--tr-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRtl ? 'الإشعارات' : 'Notifications'}
          </p>

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

          {/* Section: Share */}
          <p className="text-[10px] font-bold px-1 pt-1" style={{ color: 'var(--tr-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRtl ? 'شارك طريق' : 'Share Tareeq'}
          </p>
          {/* Share section */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--tr-overlay)' }}>
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

          {/* Section: App */}
          <p className="text-[10px] font-bold px-1 pt-1" style={{ color: 'var(--tr-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRtl ? 'التطبيق' : 'App'}
          </p>

          {/* Theme toggle */}
          <div className="flex items-center gap-3.5 px-4 py-3 rounded-2xl" style={{ background: 'var(--tr-overlay)' }}>
            <div style={iconBox('var(--tr-overlay)', 'var(--tr-border-soft)')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            </div>
            <span className="font-bold text-sm flex-1" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'المظهر' : 'Appearance'}
            </span>
            <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)' }}>
              {(['light', 'dark'] as const).map(mode => {
                const labels: Record<string, string> = isRtl
                  ? { light: 'فاتح', dark: 'داكن' }
                  : { light: 'Light', dark: 'Dark' };
                const active = themeMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => applyTheme(mode)}
                    className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all"
                    style={active
                      ? { background: 'var(--tr-gold)', color: '#fff', boxShadow: '0 1px 4px var(--tr-gold-glow)' }
                      : { background: 'transparent', color: 'var(--tr-text-muted)' }
                    }
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
          </div>

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
              <img src="/ml-logo-new.png" alt="Moslim Leader" className="w-6 h-6 object-contain" />
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

          {/* Section: Session */}
          <p className="text-[10px] font-bold px-1 pt-1" style={{ color: 'var(--tr-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {isRtl ? 'الجلسة' : 'Session'}
          </p>
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
  const { notifCount, messageCount } = useTareeqNotifications();
  const pathname = usePathname();
  const router = useRouter();

  /* ── Profile sheet state ─────────────────────────────── */
  const [showProfile, setShowProfile] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    callId: string; callType: 'audio' | 'video'; remoteUser: CallParty;
  } | null>(null);

  /* ── Camera ──────────────────────────────────────────── */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const count = parseInt(localStorage.getItem(CAM_HINT_KEY) ?? '0', 10);
    setShowHint(count < CAM_HINT_MAX);
  }, []);

  /* ── Open settings via custom event (e.g. from profile page) ── */
  useEffect(() => {
    const h = () => setShowProfile(true);
    window.addEventListener('tareeq:open-settings', h);
    return () => window.removeEventListener('tareeq:open-settings', h);
  }, []);

  /* ── Gesture refs (no re-render during drag) ─────────── */
  const btnRef = useRef<HTMLButtonElement>(null);
  const svgPathRef = useRef<SVGPathElement>(null);
  const svgStrokePathRef = useRef<SVGPathElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const animRafRef = useRef<number | null>(null);
  const addIconRef = useRef<HTMLDivElement>(null);
  const camIconRef = useRef<HTMLDivElement>(null);

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

  async function startCallFromContacts(contact: CallParty, callType: 'audio' | 'video') {
    setShowContacts(false);
    try {
      const res = await fetch('/api/tareeq/calls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ calleeId: contact.id, type: callType }),
      });
      if (res.ok) {
        const { callId } = await res.json();
        setActiveCall({ callId, callType, remoteUser: contact });
      }
    } catch { /* network error */ }
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
    if (svgStrokePathRef.current) {
      svgStrokePathRef.current.setAttribute('d', buildNavStrokePath(clamped));
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
    // RAF interpolation for SVG path
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    const start = performance.now();
    const dur = 420;
    function step(now: number) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      if (svgPathRef.current) svgPathRef.current.setAttribute('d', buildNavPath(fromDy * (1 - ease)));
      if (svgStrokePathRef.current) svgStrokePathRef.current.setAttribute('d', buildNavStrokePath(fromDy * (1 - ease)));
      if (t < 1) {
        animRafRef.current = requestAnimationFrame(step);
      } else {
        animRafRef.current = null;
        // Fade hint out after spring settles
        setTimeout(() => {
          if (hintRef.current) {
            hintRef.current.style.transition = 'opacity 0.5s ease-out';
            hintRef.current.style.opacity = '0';
          }
        }, 800);
        onDone?.();
      }
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
    if (svgStrokePathRef.current) svgStrokePathRef.current.setAttribute('d', buildNavStrokePath(0));
    // Show the camera hint when user touches the button
    if (hintRef.current) {
      hintRef.current.style.transition = 'opacity 0.18s ease-out';
      hintRef.current.style.opacity = '1';
    }
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
        // Swap to camera icon
        if (addIconRef.current) addIconRef.current.style.opacity = '0';
        if (camIconRef.current) camIconRef.current.style.opacity = '1';
      }
    }
  }

  function onBtnPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g.active || g.pointerId !== e.pointerId) return;
    g.active = false; g.pointerId = null;
    const { mode, dy } = g;
    g.mode = 'idle';
    // Reset glow + restore add icon
    if (btnRef.current) btnRef.current.style.boxShadow = '';
    if (addIconRef.current) addIconRef.current.style.opacity = '1';
    if (camIconRef.current) camIconRef.current.style.opacity = '0';

    if (mode !== 'drag') {
      // TAP → animate + create post
      playTapAnim();
      if (navigator.vibrate) navigator.vibrate(8);
      onCreateClick();
      // Fade hint after tap
      setTimeout(() => {
        if (hintRef.current) {
          hintRef.current.style.transition = 'opacity 0.5s ease-out';
          hintRef.current.style.opacity = '0';
        }
      }, 300);
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

      {/* ── Active call (started from contacts) ─────────── */}
      {activeCall && (
        <TareeqCallScreen
          callId={activeCall.callId}
          role="caller"
          callType={activeCall.callType}
          remoteUser={activeCall.remoteUser}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* ── Contacts sheet ───────────────────────────────── */}
      {showContacts && user && (
        <ContactsSheet
          onClose={() => setShowContacts(false)}
          onStartCall={startCallFromContacts}
        />
      )}

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
          if (addIconRef.current) addIconRef.current.style.opacity = '1';
          if (camIconRef.current) camIconRef.current.style.opacity = '0';
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
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          zIndex: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          willChange: 'transform',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {/* Gold star icon */}
        <div
          ref={addIconRef}
          style={{ transition: 'opacity 0.18s ease', pointerEvents: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden>
            {/* 8-pointed star */}
            <path
              d="M12 2L14.39 7.72L20.78 6.18L17.56 12L20.78 17.82L14.39 16.28L12 22L9.61 16.28L3.22 17.82L6.44 12L3.22 6.18L9.61 7.72Z"
              fill="var(--tr-gold)"
              stroke="rgba(255,200,0,0.35)"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {/* Camera overlay — glassy blue, revealed on swipe-up */}
        <div
          ref={camIconRef}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
            background: 'rgba(170,205,255,0.22)',
            backdropFilter: 'blur(14px) saturate(135%)',
            WebkitBackdropFilter: 'blur(14px) saturate(135%)',
            border: '1px solid rgba(255,255,255,0.32)',
            boxShadow: '0 8px 24px rgba(70,120,210,0.18)',
            opacity: 0, transition: 'opacity 0.18s ease', pointerEvents: 'none',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        </div>

        {/* Swipe-up hint — hidden by default, shown only on touch (opacity driven by DOM refs) */}
        {showHint && (
          <div
            ref={hintRef}
            className="absolute pointer-events-none flex flex-col items-center"
            style={{ bottom: '110%', marginBottom: 4, opacity: 0, transition: 'opacity 0.18s ease-out' }}
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
          {/* Fill — no stroke (eliminates bottom border) */}
          <path
            ref={svgPathRef}
            d={buildNavPath(0)}
            fill="var(--tr-surface)"
            stroke="none"
          />
          {/* Top curved line only — stroke, no fill */}
          <path
            ref={svgStrokePathRef}
            d={buildNavStrokePath(0)}
            fill="none"
            stroke={NAV_ACCENT}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>

        {/* Nav items */}
        <div
          dir="rtl"
          className="relative flex items-end justify-around px-3"
          style={{ height: NAV_H, paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 1 }}
        >
          {/* 1 — Profile avatar → navigates to own profile page */}
          <button
            onClick={() => user ? router.push(`/tareeq/u/${user.id}`) : router.push('/login?next=/tareeq')}
            className="flex flex-col items-center justify-end gap-1 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name ?? ''}
                className="w-7 h-7 rounded-full object-cover"
                style={{ border: '2px solid var(--tr-gold-dim)', opacity: 0.85 }} />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)', opacity: 0.85 }}>
                {user?.name?.charAt(0) ?? '?'}
              </div>
            )}
          </button>

          {/* 2 — اكتشف (discover — binoculars icon) */}
          <Link
            href="/tareeq"
            className="flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44 }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.65} viewBox="0 0 24 24"
              style={{
                color: isHome ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                filter: isHome ? 'drop-shadow(0 0 6px var(--tr-gold-glow))' : 'none',
                transition: 'all 0.2s',
              }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, color: isHome ? 'var(--tr-gold)' : 'var(--tr-text-muted)', transition: 'color 0.2s' }}>
              {isRtl ? 'اكتشف' : 'Discover'}
            </span>
          </Link>

          {/* 3 — Center spacer + label */}
          <div className="flex flex-col items-center justify-end pb-2" style={{ width: CIRCLE_SIZE, minWidth: CIRCLE_SIZE }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tr-gold)', lineHeight: 1, letterSpacing: '0.02em' }}>
              {isRtl ? 'ضع علامة' : 'Post'}
            </span>
          </div>

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
            {messageCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-black px-0.5"
                style={{ background: '#f43f5e', color: '#fff' }}>
                {messageCount > 9 ? '9+' : messageCount}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, color: isInbox ? 'var(--tr-gold)' : 'var(--tr-text-muted)', transition: 'color 0.2s' }}>
              {isRtl ? 'رسائل' : 'Chat'}
            </span>
          </Link>

          {/* 5 — Contacts / Quick Call */}
          <button
            onClick={() => { if (user) setShowContacts(true); else router.push('/login?next=/tareeq'); }}
            className="flex flex-col items-center justify-end gap-0.5 pb-2 transition-all active:scale-90"
            style={{ minWidth: 44, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
              style={{
                color: showContacts ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                filter: showContacts ? 'drop-shadow(0 0 5px rgba(212,168,83,0.45))' : 'none',
                transition: 'all 0.2s',
              }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, color: showContacts ? 'var(--tr-gold)' : 'var(--tr-text-muted)', transition: 'color 0.2s' }}>
              {isRtl ? 'اتصال' : 'Call'}
            </span>
          </button>
        </div>
      </nav>

      {/* Safe-area spacer */}
      <div className="h-[calc(62px+env(safe-area-inset-bottom,0px))] shrink-0 pointer-events-none" aria-hidden />
    </>
  );
}
