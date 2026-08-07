'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';

interface Props { onCreateClick: () => void; }

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

export default function TareeqHeader({ onCreateClick }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { notifCount } = useTareeqNotifications();

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 print:hidden"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(26,20,18,0.06)',
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

          {/* Center: wordmark */}
          <Link href="/tareeq" className="flex items-center gap-2" aria-label="Tareeq Home">
            <span className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
              <img src="/Tareeq-small.png" alt="" className="w-full h-full object-cover" />
            </span>
            <span className="font-black text-sm tracking-wide" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'طريق' : 'Tareeq'}
            </span>
          </Link>

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
