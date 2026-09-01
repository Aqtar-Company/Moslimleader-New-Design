'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { CreateGroupModal } from '../inbox/TareeqInboxClient';

const BLUE      = '#1a6ed4';
const BLUE_SOFT = 'rgba(26,110,212,0.10)';

interface MyGroup {
  id: string; name: string; imageUrl?: string | null; lastMessage?: string | null;
  memberCount: number; role: string;
}
interface PublicGroup {
  id: string; name: string; description?: string | null; imageUrl?: string | null;
  memberCount: number; createdAt: string;
}

function GroupAvatar({ url, name }: { url?: string | null; name: string }) {
  return (
    <div className="w-11 h-11 rounded-2xl shrink-0 overflow-hidden flex items-center justify-center text-lg font-bold"
      style={{ background: BLUE_SOFT, color: BLUE, border: `1.5px solid ${BLUE_SOFT}` }}>
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

export default function TareeqGroupsListClient() {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch('/api/tareeq/groups', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/tareeq/groups?discover=true', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
    ]).then(([mine, discover]) => {
      setMyGroups(mine.groups ?? []);
      setPublicGroups(discover.groups ?? []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function joinGroup(id: string) {
    setJoining(id);
    try {
      const res = await fetch(`/api/tareeq/groups/${id}/join`, { method: 'POST', credentials: 'include' });
      if (res.ok) router.push(`/tareeq/groups/${id}`);
    } finally {
      setJoining(null);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
          {isRtl ? 'سجّل الدخول لعرض المجموعات' : 'Sign in to view groups'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--tr-base)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
        style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
        <button onClick={() => router.push('/tareeq/inbox')} style={{ color: 'var(--tr-text-muted)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
        <h1 className="font-black text-base flex-1" style={{ color: 'var(--tr-text-primary)' }}>
          {isRtl ? 'المجموعات' : 'Groups'}
        </h1>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 rounded-full text-xs font-black" style={{ background: BLUE, color: '#fff' }}>
          {isRtl ? '+ جديدة' : '+ New'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-2 pt-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
        {(['mine', 'discover'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-2 text-sm font-bold transition"
            style={{
              color: tab === t ? BLUE : 'var(--tr-text-muted)',
              borderBottom: tab === t ? `2px solid ${BLUE}` : '2px solid transparent',
            }}>
            {t === 'mine' ? (isRtl ? 'مجموعاتي' : 'My Groups') : (isRtl ? 'استكشف' : 'Discover')}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: BLUE }} />
          </div>
        ) : tab === 'mine' ? (
          myGroups.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-semibold mb-4" style={{ color: 'var(--tr-text-secondary)' }}>
                {isRtl ? 'لا مجموعات بعد' : 'No groups yet'}
              </p>
              <button onClick={() => setTab('discover')}
                className="px-4 py-2 rounded-full text-sm font-bold" style={{ background: BLUE_SOFT, color: BLUE }}>
                {isRtl ? 'استكشف المجموعات العامة' : 'Discover public groups'}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {myGroups.map(g => (
                <button key={g.id} onClick={() => router.push(`/tareeq/groups/${g.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl transition text-start"
                  style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
                  <GroupAvatar url={g.imageUrl} name={g.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{g.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--tr-text-muted)' }}>
                      {g.lastMessage || `${g.memberCount} ${isRtl ? 'عضو' : 'members'}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : publicGroups.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
              {isRtl ? 'لا توجد مجموعات عامة حالياً' : 'No public groups right now'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {publicGroups.map(g => (
              <div key={g.id} className="w-full flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
                <GroupAvatar url={g.imageUrl} name={g.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{g.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--tr-text-muted)' }}>
                    {g.description || `${g.memberCount} ${isRtl ? 'عضو' : 'members'}`}
                  </p>
                </div>
                <button onClick={() => joinGroup(g.id)} disabled={joining === g.id}
                  className="px-3 py-1.5 rounded-full text-xs font-black shrink-0 disabled:opacity-50"
                  style={{ background: BLUE, color: '#fff' }}>
                  {joining === g.id ? (isRtl ? '...' : '...') : (isRtl ? 'انضمام' : 'Join')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={(groupId) => { loadAll(); if (groupId) router.push(`/tareeq/groups/${groupId}`); }}
        />
      )}
    </div>
  );
}
