'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TareeqInstallButton } from './TareeqPWA';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';

interface Props {
  onCreateClick: () => void;
  postCount?: number;
}

const PLATFORM_URL = 'https://moslimleader.com/tareeq';

const widgetStyle = {
  background: 'var(--tr-surface)',
  border: '1px solid var(--tr-border-subtle)',
  borderRadius: 16,
  padding: 16,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-black mb-3" style={{ color: 'var(--tr-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
      {children}
    </p>
  );
}

export default function TareeqSidebar({ onCreateClick, postCount }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { pushPermission, enablePush, disablePush } = useTareeqNotifications();

  const tagline = encodeURIComponent(isRtl
    ? 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — اترك علامة يهتدي بها غيرك'
    : 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — Leave a mark to guide others');
  const platformText = encodeURIComponent(`${isRtl ? 'طريق — اترك علامة يهتدي بها غيرك' : 'Tareeq — Leave a mark to guide others'} ${PLATFORM_URL}`);
  const encodedUrl = encodeURIComponent(PLATFORM_URL);

  const socialLinks = [
    { label: 'X', color: '#ffffff', href: `https://twitter.com/intent/tweet?text=${tagline}&url=${encodedUrl}` },
    { label: 'WhatsApp', color: '#25D366', href: `https://api.whatsapp.com/send?text=${platformText}` },
    { label: 'Facebook', color: '#4c8ef0', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: 'Telegram', color: '#4aaed9', href: `https://t.me/share/url?url=${encodedUrl}&text=${tagline}` },
  ];

  return (
    <div className="space-y-3">
      {/* Profile card */}
      {user && (
        <div style={widgetStyle}>
          <div className="flex items-center gap-3 mb-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
                style={{ boxShadow: '0 0 0 2px var(--tr-gold-dim)' }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', boxShadow: '0 0 0 2px var(--tr-gold-dim)', border: '1px solid var(--tr-border-soft)' }}
              >
                {user.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{user.name}</p>
              {postCount != null && (
                <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
                  {isRtl ? `${postCount} علامة` : `${postCount} marks`}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/tareeq/profile"
            className="flex items-center justify-center gap-1.5 w-full text-xs font-bold py-2 rounded-xl transition"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-gold)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--tr-gold-dim)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--tr-border-soft)'; }}
          >
            {isRtl ? 'منشوراتي' : 'My Posts'}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
            </svg>
          </Link>
        </div>
      )}

      {/* Leave a mark CTA */}
      <button
        onClick={onCreateClick}
        className="w-full flex items-center justify-center gap-2 font-black text-sm py-3 rounded-2xl transition active:scale-95"
        style={{
          background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))',
          color: '#0a0d06',
          boxShadow: '0 4px 24px var(--tr-gold-glow)',
        }}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {isRtl ? 'اترك علامتك' : 'Leave Your Mark'}
      </button>

      {/* Share */}
      <div style={widgetStyle}>
        <SectionLabel>{isRtl ? 'شارك طريق' : 'Share Tareeq'}</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {socialLinks.map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition hover:opacity-90 active:scale-95"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.color + '44'; (e.currentTarget as HTMLElement).style.color = s.color; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tr-border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-secondary)'; }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Push notifications — blocked */}
      {user && pushPermission === 'denied' && (
        <div
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'الإشعارات محظورة' : 'Notifications blocked'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'فعّلها من إعدادات المتصفح' : 'Enable in browser settings'}
            </p>
          </div>
        </div>
      )}

      {/* Push notifications — available */}
      {user && pushPermission !== 'unsupported' && pushPermission !== 'denied' && (
        <button
          onClick={pushPermission === 'granted' ? disablePush : enablePush}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition text-start"
          style={{
            background: pushPermission === 'granted' ? 'var(--tr-teal-dim)' : 'var(--tr-surface)',
            border: pushPermission === 'granted' ? '1px solid var(--tr-teal)44' : '1px solid var(--tr-border-soft)',
          }}
        >
          {pushPermission === 'granted' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-teal)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.964 8.964 0 002.313-6.022v-.75m5.998 7.082A24.248 24.248 0 0015 17.23m0 0a24.255 24.255 0 003.854-.148m-3.854.148a3 3 0 005.714 0m-5.714 0H9.143m8.573-9.33a3 3 0 10-5.142 0M12 3v1.5" />
            </svg>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: pushPermission === 'granted' ? 'var(--tr-teal)' : 'var(--tr-text-secondary)' }}>
              {pushPermission === 'granted'
                ? (isRtl ? 'الإشعارات مفعّلة' : 'Notifications On')
                : (isRtl ? 'فعّل الإشعارات' : 'Enable Notifications')}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>
              {pushPermission === 'granted'
                ? (isRtl ? 'اضغط لإلغاء التفعيل' : 'Tap to disable')
                : (isRtl ? 'تلقّ إشعارات على جهازك' : 'Get notified on your device')}
            </p>
          </div>
        </button>
      )}

      {/* Install app */}
      <TareeqInstallButton variant="full" />

      {/* About */}
      <div style={widgetStyle}>
        <SectionLabel>{isRtl ? 'عن طريق' : 'About Tareeq'}</SectionLabel>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tr-text-muted)' }}>
          {isRtl
            ? 'طريق مساحة مجتمعية لمشاركة التجارب والأفكار التي تهدي غيرك. وَبِالنَّجْمِ هُمْ يَهْتَدُونَ.'
            : 'Tareeq is a community space for sharing experiences and ideas that guide others. وَبِالنَّجْمِ هُمْ يَهْتَدُونَ.'}
        </p>
      </div>
    </div>
  );
}
