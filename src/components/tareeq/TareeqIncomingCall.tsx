'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import TareeqCallScreen, { CallParty } from './TareeqCallScreen';

interface IncomingCall {
  id: string;
  type: 'audio' | 'video';
  offer: string;
  caller: CallParty;
}

export default function TareeqIncomingCall() {
  const { user } = useAuth();
  const { isRtl } = useLang();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [accepted, setAccepted] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    async function poll() {
      try {
        const res = await fetch('/api/tareeq/calls/incoming', { credentials: 'include' });
        if (!res.ok) return;
        const { call } = await res.json();
        if (!call || seenRef.current.has(call.id)) return;
        setIncoming(call);
      } catch { /* offline */ }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  function dismiss() {
    if (incoming) seenRef.current.add(incoming.id);
    setIncoming(null);
    setAccepted(false);
  }

  async function decline() {
    if (!incoming) return;
    seenRef.current.add(incoming.id);
    await fetch(`/api/tareeq/calls/${incoming.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'reject' }),
    }).catch(() => {});
    setIncoming(null);
  }

  function accept() {
    setAccepted(true);
  }

  if (!incoming) return null;

  if (accepted) {
    return (
      <TareeqCallScreen
        callId={incoming.id}
        role="callee"
        callType={incoming.type}
        remoteUser={incoming.caller}
        offer={incoming.offer}
        onEnd={dismiss}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: 'rgba(7,13,20,0.92)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex flex-col items-center gap-5 px-6 py-10 rounded-3xl max-w-xs w-full mx-4"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Pulsing ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: 'var(--tr-gold)', transform: 'scale(1.4)' }} />
          {incoming.caller.avatarUrl ? (
            <img src={incoming.caller.avatarUrl} alt={incoming.caller.name}
              className="w-24 h-24 rounded-full object-cover relative z-10"
              style={{ border: '3px solid rgba(212,168,83,0.5)' }} />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center font-black text-4xl relative z-10"
              style={{ background: 'linear-gradient(135deg,#1a4a3a,#0d9488)', color: '#fff', border: '3px solid rgba(212,168,83,0.5)' }}>
              {incoming.caller.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--tr-text-muted)' }}>
            {incoming.type === 'video'
              ? (isRtl ? '📹 مكالمة فيديو واردة' : '📹 Incoming video call')
              : (isRtl ? '🎙️ مكالمة صوتية واردة' : '🎙️ Incoming voice call')}
          </p>
          <h2 className="font-black text-xl" style={{ color: 'var(--tr-text-primary)' }}>
            {incoming.caller.name}
          </h2>
        </div>

        <div className="flex items-center gap-8 mt-2">
          <button onClick={decline} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ background: '#ef4444', boxShadow: '0 6px 20px rgba(239,68,68,0.4)' }}>
              ✕
            </div>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'رفض' : 'Decline'}
            </span>
          </button>
          <button onClick={accept} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ background: '#22c55e', boxShadow: '0 6px 20px rgba(34,197,94,0.4)' }}>
              ✓
            </div>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'قبول' : 'Accept'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
