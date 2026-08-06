'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';

interface Props { onCreateClick: () => void; }

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none"
      style={{ background: '#f43f5e', color: '#fff' }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function TareeqHeader({ onCreateClick }: Props) {
  const { isRtl } = useLang();
  const { notifCount, messageCount } = useTareeqNotifications();

  return (
    <>
      <header className="fixed top-3 left-4 right-4 z-50 print:hidden">
        <div
          className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-4 h-12 rounded-2xl"
          style={{
            background: 'rgba(250,248,244,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(26,24,40,0.10)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.09), inset 0 -1px 0 rgba(26,24,40,0.05)',
          }}
        >
          {/* Start — notifications + inbox */}
          <div className="flex items-center gap-0.5">
            <Link
              href="/tareeq/notifications"
              className="relative w-9 h-9 flex items-center justify-center rounded-xl transition"
              style={{ color: 'var(--tr-text-secondary)' }}
              aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--tr-gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--tr-text-secondary)')}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <Badge count={notifCount} />
            </Link>
            <Link
              href="/tareeq/inbox"
              className="relative w-9 h-9 flex items-center justify-center rounded-xl transition"
              style={{ color: 'var(--tr-text-secondary)' }}
              aria-label={isRtl ? 'الرسائل' : 'Messages'}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--tr-gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--tr-text-secondary)')}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <Badge count={messageCount} />
            </Link>
          </div>

          {/* Center — wordmark */}
          <Link href="/tareeq" className="flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
            <span style={{ color: 'var(--tr-gold)', fontSize: 14 }}>★</span>
            <span className="font-black text-sm tracking-wide" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'طريق' : 'Tareeq'}
            </span>
          </Link>

          {/* End — create button */}
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1.5 font-black text-xs px-4 py-1.5 rounded-full transition active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold))',
              color: '#0d1208',
              boxShadow: '0 0 14px var(--tr-gold-glow)',
            }}
          >
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="hidden sm:inline">{isRtl ? 'علامة' : 'Mark'}</span>
          </button>
        </div>
      </header>
      {/* Spacer replaces the old h-11 spacer — the floating header needs more top room */}
      <div className="h-[72px]" />
    </>
  );
}
