'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

interface TareeqNotificationsCtx {
  notifCount: number;
  messageCount: number;
  refresh: () => void;
}

const Ctx = createContext<TareeqNotificationsCtx>({ notifCount: 0, messageCount: 0, refresh: () => {} });

export function TareeqNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!user || typeof document !== 'undefined' && document.hidden) return;
    try {
      const [nRes, cRes] = await Promise.all([
        fetch('/api/tareeq/notifications?countOnly=true', { credentials: 'include' }),
        fetch('/api/tareeq/conversations', { credentials: 'include' }),
      ]);
      if (nRes.ok) {
        const d = await nRes.json();
        setNotifCount(d.unreadCount ?? 0);
      }
      if (cRes.ok) {
        const d = await cRes.json();
        const total = (d.conversations ?? []).reduce((s: number, c: { unreadCount: number }) => s + (c.unreadCount ?? 0), 0);
        setMessageCount(total);
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifCount(0);
      setMessageCount(0);
      return;
    }
    poll();
    timerRef.current = setInterval(poll, 30_000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, poll]);

  return (
    <Ctx.Provider value={{ notifCount, messageCount, refresh: poll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTareeqNotifications() {
  return useContext(Ctx);
}
