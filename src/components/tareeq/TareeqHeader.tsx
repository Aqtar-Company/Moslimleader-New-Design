'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import TareeqCallScreen from './TareeqCallScreen';

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

interface IncomingCall {
  id: string;
  type: 'audio' | 'video';
  offer: string;
  caller: { id: string; name: string; avatarUrl?: string | null };
}

export default function TareeqHeader({ onCreateClick, searchInput, onSearch, onToggleSidebar }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { notifCount } = useTareeqNotifications();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<IncomingCall | null>(null);
  const incomingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenCallRef = useRef<string>('');

  // Poll for incoming calls when logged in
  useEffect(() => {
    if (!user) return;
    incomingPollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/tareeq/calls/incoming', { credentials: 'include' });
        if (!res.ok) return;
        const { call } = await res.json();
        if (call && call.id !== seenCallRef.current) {
          seenCallRef.current = call.id;
          setIncomingCall(call);
        } else if (!call) {
          setIncomingCall(null);
        }
      } catch { /* ignore */ }
    }, 5_000);
    return () => { if (incomingPollRef.current) clearInterval(incomingPollRef.current); };
  }, [user]);

  async function rejectCall(callId: string) {
    setIncomingCall(null);
    await fetch(`/api/tareeq/calls/${callId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'reject' }),
    }).catch(() => {});
  }

  function acceptCall(call: IncomingCall) {
    setIncomingCall(null);
    setActiveCall(call);
  }

  return (
    <>
      {/* Incoming call banner */}
      {incomingCall && !activeCall && (
        <div
          className="fixed top-0 left-0 right-0 z-[110] flex items-center gap-3 px-4 py-3"
          style={{ background: 'rgba(7,13,20,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--tr-gold-dim)' }}
        >
          <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
            {incomingCall.caller.avatarUrl
              ? <img src={incomingCall.caller.avatarUrl} alt="" className="w-full h-full object-cover" />
              : incomingCall.caller.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{incomingCall.caller.name}</p>
            <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>
              {incomingCall.type === 'video' ? '📹 ' : '🎙️ '}{isRtl ? 'مكالمة واردة' : 'Incoming call'}
            </p>
          </div>
          <button
            onClick={() => rejectCall(incomingCall.id)}
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition active:scale-90"
            style={{ background: '#ef4444', color: '#fff' }}
          >✕</button>
          <button
            onClick={() => acceptCall(incomingCall)}
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition active:scale-90"
            style={{ background: '#22c55e', color: '#fff' }}
          >✓</button>
        </div>
      )}

      {/* Active call screen (callee accepted from banner) */}
      {activeCall && (
        <TareeqCallScreen
          callId={activeCall.id}
          role="callee"
          callType={activeCall.type}
          remoteUser={activeCall.caller}
          offer={activeCall.offer}
          onEnd={() => setActiveCall(null)}
        />
      )}

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
        <div className="max-w-2xl mx-auto lg:max-w-[1180px] flex items-center justify-between px-4 h-14 gap-2 lg:gap-4">

          {/* Left */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/tareeq/profile" className="lg:hidden shrink-0" aria-label={isRtl ? 'ملفي الشخصي' : 'My profile'}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name ?? ''} className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid var(--tr-gold)' }} />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold)' }}>
                  {user?.name?.charAt(0) ?? '?'}
                </div>
              )}
            </Link>
            <Link href="/tareeq" className="hidden lg:flex items-center gap-2" aria-label="Tareeq">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', boxShadow: '0 2px 8px var(--tr-gold-glow)' }}>
                <svg className="w-4 h-4" fill="#fff" viewBox="0 0 24 24">
                  <path d="M12 3l1.4 5.6L18.4 5.6l-3 4.4L21 12l-5.6 1.4 2.4 5.4-4.8-2.8L12 21l-1.4-5.6-5.4 2.4 2.8-4.8L3 12l5.6-1.4L6.2 5z" />
                </svg>
              </div>
              <span className="font-black text-xl tracking-tight" style={{ color: 'var(--tr-text-primary)' }}>
                {isRtl ? 'طريق' : 'Tareeq'}
              </span>
            </Link>
          </div>

          {/* Center */}
          {onSearch !== undefined ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 lg:max-w-sm">
                <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={searchInput ?? ''}
                  onChange={e => onSearch(e.target.value)}
                  placeholder={isRtl ? 'ابحث في العلامات...' : 'Search marks...'}
                  className="w-full rounded-full ps-8 pe-4 py-2 text-xs focus:outline-none transition"
                  style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                />
              </div>
              {onToggleSidebar && (
                <button onClick={onToggleSidebar} className="lg:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition" style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <Link href="/tareeq" className="lg:hidden" aria-label="Tareeq Home">
              <span className="font-black text-sm tracking-wide" style={{ color: 'var(--tr-text-primary)' }}>
                {isRtl ? 'طريق' : 'Tareeq'}
              </span>
            </Link>
          )}

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/tareeq/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-full transition" style={{ background: 'var(--tr-raised)' }}>
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <Badge count={notifCount} />
            </Link>
            <button
              onClick={onCreateClick}
              className="hidden lg:flex items-center gap-1.5 font-black text-xs px-4 py-2 rounded-full transition active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#fff', boxShadow: '0 2px 10px var(--tr-gold-glow)' }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {isRtl ? 'علامة جديدة' : 'New Mark'}
            </button>
          </div>
        </div>
      </header>
      <div className="h-14" />
    </>
  );
}
