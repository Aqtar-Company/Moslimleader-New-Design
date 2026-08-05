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
    fetch('/api/tareeq/conversations', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setConversations(d.conversations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <TareeqHeader onCreateClick={() => {}} />
      <div className="pt-11" />

      <div className="bg-[#0a1f1a] text-white py-8 px-4 text-center">
        <h1 className="font-black text-2xl">{isRtl ? 'الرسائل' : 'Messages'}</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-emerald-700 rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-gray-500 font-semibold">{isRtl ? 'لا رسائل بعد' : 'No messages yet'}</p>
            <p className="text-gray-400 text-sm mt-2">
              {isRtl ? 'ابدأ محادثة من صفحة أي مستخدم' : 'Start a conversation from any user profile'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => (
              <Link
                key={c.id}
                href={`/tareeq/inbox/${c.id}`}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition hover:shadow-sm ${
                  c.unreadCount > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {c.otherUser.avatarUrl
                    ? <img src={c.otherUser.avatarUrl} alt={c.otherUser.name} className="w-full h-full rounded-full object-cover" />
                    : c.otherUser.name.charAt(0)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{c.otherUser.name}</p>
                  {c.lastMessage && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{c.lastMessage}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {c.lastMessageAt && (
                    <span className="text-[10px] text-gray-400">{timeAgo(c.lastMessageAt, isRtl)}</span>
                  )}
                  {c.unreadCount > 0 && (
                    <span className="bg-emerald-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
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
