'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';

interface OtherUser { id: string; name: string; avatarUrl?: string | null; }
interface Conversation {
  id: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  otherUser: OtherUser;
}

function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return isRtl ? 'الآن' : 'now';
  if (diff < 3600) return isRtl ? `${Math.floor(diff/60)} د` : `${Math.floor(diff/60)}m`;
  if (diff < 86400) return isRtl ? `${Math.floor(diff/3600)} س` : `${Math.floor(diff/3600)}h`;
  return isRtl ? `${Math.floor(diff/86400)} ي` : `${Math.floor(diff/86400)}d`;
}

function Inner() {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    function load() {
      fetch('/api/tareeq/conversations', { credentials: 'include' })
        .then(r => r.json())
        .then(d => setConversations(d.conversations ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    load();
    // Fix 3: re-fetch when user navigates back so unread badges are fresh
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, router]);

  return (
    <div className="min-h-screen">
      <TareeqHeader onCreateClick={() => {}} />

      <div className="py-8 px-4 text-center">
        <h1 className="font-black text-2xl" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'الرسائل' : 'Messages'}</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-2 pb-28">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-14 h-14 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا رسائل بعد' : 'No messages yet'}</p>
            <p className="text-sm mt-2" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'ابدأ محادثة من صفحة أي مستخدم' : 'Start a conversation from any user profile'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => (
              <Link
                key={c.id}
                href={`/tareeq/inbox/${c.id}`}
                className="flex items-center gap-3 p-4 rounded-2xl transition"
                style={{
                  background: c.unreadCount > 0 ? 'var(--tr-raised)' : 'var(--tr-surface)',
                  border: c.unreadCount > 0 ? '1px solid var(--tr-gold-dim)' : '1px solid var(--tr-border-subtle)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = c.unreadCount > 0 ? 'var(--tr-raised)' : 'var(--tr-surface)'; }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden"
                  style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1px solid var(--tr-border-soft)' }}
                >
                  {c.otherUser.avatarUrl
                    ? <img src={c.otherUser.avatarUrl} alt={c.otherUser.name} className="w-full h-full rounded-full object-cover" />
                    : c.otherUser.name.charAt(0)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{c.otherUser.name}</p>
                  {c.lastMessage && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{c.lastMessage}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {c.lastMessageAt && (
                    <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(c.lastMessageAt, isRtl)}</span>
                  )}
                  {c.unreadCount > 0 && (
                    <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TareeqInboxClient() {
  return (
    <TareeqNotificationsProvider>
      <Inner />
    </TareeqNotificationsProvider>
  );
}
