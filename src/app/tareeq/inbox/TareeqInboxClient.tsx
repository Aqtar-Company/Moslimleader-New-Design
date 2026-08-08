'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqBottomNav from '@/components/tareeq/TareeqBottomNav';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';

interface OtherUser { id: string; name: string; avatarUrl?: string | null }
interface Conversation {
  id: string; lastMessage?: string | null; lastMessageAt?: string | null;
  unreadCount: number; otherUser: OtherUser;
}
interface Group {
  id: string; name: string; imageUrl?: string | null; lastMessage?: string | null;
  lastMessageAt?: string | null; memberCount: number; role: string;
}

function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return isRtl ? 'الآن' : 'now';
  if (diff < 3600) return isRtl ? `${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return isRtl ? `${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h`;
  return isRtl ? `${Math.floor(diff / 86400)} ي` : `${Math.floor(diff / 86400)}d`;
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (groupId: string) => void }) {
  const { isRtl } = useLang();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) { setError(isRtl ? 'أدخل اسم المجموعة' : 'Enter group name'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/tareeq/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (res.ok) { onCreated(d.group?.id ?? ''); onClose(); }
      else setError(d.error || (isRtl ? 'حدث خطأ' : 'Error'));
    } catch { setError(isRtl ? 'خطأ في الاتصال' : 'Connection error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'مجموعة جديدة' : 'New Group'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>×</button>
        </div>
        {error && <p className="text-xs text-center py-1 px-3 rounded-lg font-semibold" style={{ color: '#f87171', background: 'rgba(248,113,113,0.10)' }}>{error}</p>}
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={isRtl ? 'اسم المجموعة' : 'Group name'}
          autoFocus
          maxLength={50}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
        />
        <button
          onClick={submit}
          disabled={loading || !name.trim()}
          className="w-full py-3 rounded-xl font-black text-sm transition disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,var(--tr-gold-dim),var(--tr-gold-bright))', color: '#0a0d06' }}
        >
          {loading ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء المجموعة' : 'Create Group')}
        </button>
      </div>
    </div>
  );
}

function Inner() {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'dms' | 'groups'>('dms');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch('/api/tareeq/conversations', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/tareeq/groups', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
    ]).then(([c, g]) => {
      setConversations(c.conversations ?? []);
      setGroups(g.groups ?? []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    loadAll();
    const onVisible = () => { if (!document.hidden) loadAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, router]);

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '8px 0', fontWeight: 800, fontSize: 13, borderRadius: 12,
    background: active ? 'var(--tr-gold-glow)' : 'transparent',
    color: active ? 'var(--tr-gold-bright)' : 'var(--tr-text-muted)',
    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
  } as React.CSSProperties);

  return (
    <div className="min-h-screen" style={{ background: 'var(--tr-base)' }}>
      {/* Title + tabs */}
      <div className="pt-6 pb-3 px-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-black text-xl" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'الرسائل' : 'Messages'}
          </h1>
          {tab === 'groups' && (
            <button
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-full transition"
              style={{ background: 'linear-gradient(135deg,var(--tr-gold-dim),var(--tr-gold-bright))', color: '#0a0d06' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {isRtl ? 'مجموعة جديدة' : 'New Group'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--tr-overlay)' }}>
          <button style={tabStyle(tab === 'dms')} onClick={() => setTab('dms')}>
            {isRtl ? 'الرسائل' : 'Chats'}{conversations.some(c => c.unreadCount > 0) && <span className="ms-1.5 inline-flex w-4 h-4 rounded-full text-[9px] font-black items-center justify-center" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>●</span>}
          </button>
          <button style={tabStyle(tab === 'groups')} onClick={() => setTab('groups')}>
            {isRtl ? 'المجموعات' : 'Groups'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pb-28">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : tab === 'dms' ? (
          conversations.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-14 h-14 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا رسائل بعد' : 'No messages yet'}</p>
              <p className="text-sm mt-2" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'ابدأ محادثة من صفحة أي مستخدم' : 'Start a conversation from any profile'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map(c => (
                <Link key={c.id} href={`/tareeq/inbox/${c.id}`}
                  className="flex items-center gap-3 p-4 rounded-2xl transition"
                  style={{ background: c.unreadCount > 0 ? 'var(--tr-raised)' : 'var(--tr-surface)', border: c.unreadCount > 0 ? '1px solid var(--tr-gold-dim)' : '1px solid var(--tr-border-subtle)' }}
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                    {c.otherUser.avatarUrl ? <img src={c.otherUser.avatarUrl} alt={c.otherUser.name} className="w-full h-full object-cover" /> : c.otherUser.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{c.otherUser.name}</p>
                    {c.lastMessage && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>{c.lastMessage}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {c.lastMessageAt && <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(c.lastMessageAt, isRtl)}</span>}
                    {c.unreadCount > 0 && <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>{c.unreadCount}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          groups.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'var(--tr-overlay)' }}>👥</div>
              <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا مجموعات بعد' : 'No groups yet'}</p>
              <p className="text-sm mt-2 mb-6" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'أنشئ مجموعة وادعُ أصدقاءك' : 'Create a group and invite friends'}</p>
              <button onClick={() => setShowCreateGroup(true)} className="font-black px-6 py-3 rounded-full text-sm transition" style={{ background: 'linear-gradient(135deg,var(--tr-gold-dim),var(--tr-gold-bright))', color: '#0a0d06' }}>
                {isRtl ? '+ أنشئ مجموعة' : '+ Create Group'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map(g => (
                <Link key={g.id} href={`/tareeq/groups/${g.id}`}
                  className="flex items-center gap-3 p-4 rounded-2xl transition"
                  style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0 overflow-hidden" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-gold-dim)' }}>
                    {g.imageUrl ? <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" /> : '👥'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{g.name}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>
                      {g.lastMessage || (isRtl ? `${g.memberCount} أعضاء` : `${g.memberCount} members`)}
                    </p>
                  </div>
                  {g.lastMessageAt && (
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(g.lastMessageAt, isRtl)}</span>
                  )}
                </Link>
              ))}
            </div>
          )
        )}
      </div>

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={(groupId) => { loadAll(); if (groupId) router.push(`/tareeq/groups/${groupId}`); }} />
      )}
      <TareeqBottomNav onCreateClick={() => {}} />
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
