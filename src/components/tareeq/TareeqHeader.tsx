'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';

interface Props { onCreateClick: () => void; }

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function TareeqHeader({ onCreateClick }: Props) {
  const { isRtl } = useLang();
  const { notifCount, messageCount } = useTareeqNotifications();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1f1a]/95 backdrop-blur-sm border-b border-emerald-900/40 h-11 flex items-center px-4 print:hidden">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-2">

        {/* Start — notifications + inbox */}
        <div className="flex items-center gap-1">
          <Link
            href="/tareeq/notifications"
            className="relative w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition"
            aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <Badge count={notifCount} />
          </Link>
          <Link
            href="/tareeq/inbox"
            className="relative w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition"
            aria-label={isRtl ? 'الرسائل' : 'Messages'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <Badge count={messageCount} />
          </Link>
        </div>

        {/* Center — Tareeq identity */}
        <Link href="/tareeq" className="flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2">
          <span className="w-6 h-6 rounded-md overflow-hidden shrink-0">
            <img src="/tareeq-logo- circle.png" alt="طريق" className="w-full h-full object-cover" />
          </span>
          <span className="font-black text-white text-sm tracking-wide">
            {isRtl ? 'طريق' : 'Tareeq'}
          </span>
        </Link>

        {/* End — create button */}
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-full transition"
        >
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="hidden sm:inline">{isRtl ? 'علامة' : 'Mark'}</span>
        </button>

      </div>
    </header>
  );
}
