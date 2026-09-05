'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import TareeqNotebookPopup from '@/components/tareeq/TareeqNotebookPopup';

interface OtherUser { id: string; name: string; avatarUrl?: string | null }
interface Conversation {
  id: string; lastMessage?: string | null; lastMessageAt?: string | null;
  unreadCount: number; otherUser: OtherUser;
}
interface Group {
  id: string; name: string; imageUrl?: string | null; lastMessage?: string | null;
  lastMessageAt?: string | null; memberCount: number; role: string;
}

// Tareeq messaging blue — used throughout this screen
const BLUE      = '#1a6ed4';
const BLUE_SOFT = 'rgba(26,110,212,0.10)';
const BLUE_ROW  = 'rgba(26,110,212,0.055)';

function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return isRtl ? 'الآن'                     : 'now';
  if (diff < 3600)  return isRtl ? `${Math.floor(diff/60)} د`  : `${Math.floor(diff/60)}m`;
  if (diff < 86400) return isRtl ? `${Math.floor(diff/3600)} س`: `${Math.floor(diff/3600)}h`;
  if (diff < 86400*2) return isRtl ? 'أمس' : 'Yesterday';
  return isRtl ? `${Math.floor(diff/86400)} ي` : `${Math.floor(diff/86400)}d`;
}

export function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (groupId: string) => void }) {
  const { isRtl } = useLang();
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) { setError(isRtl ? 'أدخل اسم المجموعة' : 'Enter group name'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/tareeq/groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ name: name.trim(), isPublic }),
      });
      const d = await res.json();
      if (res.ok) { onCreated(d.group?.id ?? ''); onClose(); }
      else setError(d.error || (isRtl ? 'حدث خطأ' : 'Error'));
    } catch { setError(isRtl ? 'خطأ في الاتصال' : 'Connection error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'مجموعة جديدة' : 'New Group'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>&times;</button>
        </div>
        {error && (
          <p className="text-xs text-center py-1 px-3 rounded-lg font-semibold"
            style={{ color: '#f87171', background: 'rgba(248,113,113,0.10)' }}>{error}</p>
        )}
        <input
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={isRtl ? 'اسم المجموعة' : 'Group name'}
          autoFocus maxLength={50}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
        />
        <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
            className="w-4 h-4 rounded" style={{ accentColor: BLUE }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
            {isRtl ? 'مجموعة عامة (يظهر في الاستكشاف، يمكن لأي شخص الانضمام)' : 'Public group (shown in discovery, anyone can join)'}
          </span>
        </label>
        <button onClick={submit} disabled={loading || !name.trim()}
          className="w-full py-3 rounded-xl font-black text-sm transition disabled:opacity-40"
          style={{ background: BLUE, color: '#fff' }}>
          {loading ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء المجموعة' : 'Create Group')}
        </button>
      </div>
    </div>
  );
}

function RowAvatar({ url, name, emoji }: { url?: string | null; name: string; emoji?: string }) {
  return (
    <div className="w-[50px] h-[50px] rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-base"
      style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', border: '1.5px solid var(--tr-border-soft)' }}>
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : emoji
        ? <span>{emoji}</span>
        : <span style={{ fontSize: 18 }}>{name.charAt(0)}</span>
      }
    </div>
  );
}

function Inner() {
  const { isRtl } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'dms' | 'groups' | 'requests'>('dms');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [msgRequests, setMsgRequests] = useState<{ id: string; message: string; createdAt: string; from: { id: string; name: string; avatarUrl?: string | null; username?: string | null } }[]>([]);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);
  const [reqError, setReqError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch('/api/tareeq/conversations', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/tareeq/groups', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/tareeq/message-requests', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
    ]).then(([c, g, r]) => {
      setConversations(c.conversations ?? []);
      setGroups(g.groups ?? []);
      setMsgRequests(r.requests ?? []);
    }).finally(() => setLoading(false));
  }

  async function handleRequest(reqId: string, action: 'accept' | 'reject') {
    setProcessingReqId(reqId);
    setReqError('');
    try {
      const res = await fetch(`/api/tareeq/message-requests/${reqId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const d = await res.json();
        setMsgRequests(prev => prev.filter(r => r.id !== reqId));
        if (action === 'accept' && d.conversationId) {
          router.push(`/tareeq/inbox/${d.conversationId}`);
        }
      } else {
        setReqError(isRtl ? 'فشلت العملية، حاول مرة أخرى' : 'Action failed, try again');
      }
    } catch {
      setReqError(isRtl ? 'خطأ في الاتصال' : 'Connection error');
    } finally { setProcessingReqId(null); }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/tareeq/login'); return; }
    loadAll();
    const onVisible = () => { if (!document.hidden) loadAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [authLoading, user, router]);

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '9px 0', fontWeight: 700, fontSize: 13, borderRadius: 10,
    background: active ? BLUE_SOFT : 'transparent',
    color: active ? BLUE : 'var(--tr-text-muted)',
    border: 'none', cursor: 'pointer', transition: 'all 0.18s',
  } as React.CSSProperties);

  const hasUnread = conversations.some(c => c.unreadCount > 0);
  const hasRequests = msgRequests.length > 0;

  // ── Conversation list (shared between mobile + desktop panel) ──────
  const conversationList = (
    <div>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: BLUE }} />
        </div>
      ) : tab === 'requests' ? (() => {
        if (msgRequests.length === 0) return (
          <div className="flex flex-col items-center px-6" style={{ paddingTop: '15dvh' }}>
            <div className="w-14 h-14 mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ background: BLUE_SOFT }}>📬</div>
            <p className="font-bold text-[15px]" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'لا طلبات جديدة' : 'No requests'}</p>
            <p className="text-[13px] mt-1.5 text-center" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'ستظهر هنا طلبات الرسائل من غير المتابَعين' : 'Message requests from non-followers appear here'}</p>
          </div>
        );
        return (
          <div className="pb-2">
            {msgRequests.map((r, idx) => (
              <div key={r.id} className="flex flex-col gap-3 px-4 py-4" style={{ borderBottom: idx < msgRequests.length - 1 ? '1px solid var(--tr-border-subtle)' : 'none' }}>
                <div className="flex items-center gap-3">
                  <RowAvatar url={r.from.avatarUrl} name={r.from.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] truncate" style={{ color: 'var(--tr-text-primary)' }}>{r.from.name}</p>
                    {r.from.username && <p className="text-[12px]" style={{ color: 'var(--tr-text-muted)' }}>@{r.from.username}</p>}
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--tr-text-primary)', background: 'var(--tr-overlay)', padding: '10px 14px', borderRadius: 12 }}>{r.message}</p>
                {reqError && processingReqId === r.id && (
                  <p className="text-xs font-semibold" style={{ color: '#e74c3c' }}>{reqError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={!!processingReqId}
                    onClick={() => handleRequest(r.id, 'accept')}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition active:scale-95"
                    style={{ background: BLUE, color: '#fff', opacity: processingReqId ? 0.6 : 1 }}
                  >{processingReqId === r.id ? '...' : (isRtl ? 'قبول' : 'Accept')}</button>
                  <button
                    disabled={!!processingReqId}
                    onClick={() => handleRequest(r.id, 'reject')}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition active:scale-95"
                    style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', opacity: processingReqId ? 0.6 : 1 }}
                  >{isRtl ? 'رفض' : 'Decline'}</button>
                </div>
              </div>
            ))}
          </div>
        );
      })() : tab === 'dms' ? (() => {
        const filtered = conversations.filter(c =>
          !searchQuery || c.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filtered.length === 0) return (
          <div className="flex flex-col items-center px-6" style={{ paddingTop: '15dvh' }}>
            <div className="w-14 h-14 mb-4 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: BLUE_SOFT }}>💬</div>
            <p className="font-bold text-[15px]" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'لا رسائل بعد' : 'No messages yet'}
            </p>
            <p className="text-[13px] mt-1.5 text-center" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'ابدأ محادثة من صفحة أي مستخدم' : 'Start a conversation from any profile'}
            </p>
          </div>
        );
        return (
          <div className="pb-2">
            {filtered.map((c, idx) => (
              <Link key={c.id} href={`/tareeq/inbox/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors"
                style={{
                  background: c.unreadCount > 0 ? BLUE_ROW : 'transparent',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--tr-border-subtle)' : 'none',
                }}>
                <RowAvatar url={c.otherUser.avatarUrl} name={c.otherUser.name} />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] truncate"
                      style={{ color: 'var(--tr-text-primary)', fontWeight: c.unreadCount > 0 ? 700 : 600 }}>
                      {c.otherUser.name}
                    </p>
                    {c.lastMessageAt && (
                      <span className="text-[11px] shrink-0"
                        style={{ color: c.unreadCount > 0 ? BLUE : 'var(--tr-text-muted)' }}>
                        {timeAgo(c.lastMessageAt, isRtl)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] truncate"
                      style={{ color: 'var(--tr-text-muted)', fontWeight: c.unreadCount > 0 ? 500 : 400 }}>
                      {c.lastMessage || (isRtl ? 'لا رسائل بعد' : 'No messages yet')}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="text-[11px] font-black shrink-0 rounded-full flex items-center justify-center"
                        style={{ background: BLUE, color: '#fff', minWidth: 20, height: 20, padding: '0 4px' }}>
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        );
      })() : (() => {
        if (groups.length === 0) return (
          <div className="flex flex-col items-center px-6" style={{ paddingTop: '15dvh' }}>
            <div className="w-14 h-14 mb-4 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: BLUE_SOFT }}>👥</div>
            <p className="font-bold text-[15px]" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'لا مجموعات بعد' : 'No groups yet'}
            </p>
            <p className="text-[13px] mt-1.5 text-center" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'أنشئ مجموعة وادعُ أصدقاءك' : 'Create a group and invite friends'}
            </p>
            <button onClick={() => setShowCreateGroup(true)}
              className="mt-5 font-black px-5 py-2.5 rounded-full text-sm transition"
              style={{ background: BLUE, color: '#fff' }}>
              {isRtl ? '+ مجموعة جديدة' : '+ New Group'}
            </button>
          </div>
        );
        return (
          <div className="pb-2">
            {groups.map((g, idx) => (
              <Link key={g.id} href={`/tareeq/groups/${g.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors"
                style={{ borderBottom: idx < groups.length - 1 ? '1px solid var(--tr-border-subtle)' : 'none' }}>
                <RowAvatar url={g.imageUrl} name={g.name} emoji={g.imageUrl ? undefined : '👥'} />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--tr-text-primary)' }}>{g.name}</p>
                    {g.lastMessageAt && (
                      <span className="text-[11px] shrink-0" style={{ color: 'var(--tr-text-muted)' }}>
                        {timeAgo(g.lastMessageAt, isRtl)}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] truncate" style={{ color: 'var(--tr-text-muted)' }}>
                    {g.lastMessage || (isRtl ? `${g.memberCount} أعضاء` : `${g.memberCount} members`)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        );
      })()}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--tr-base)' }}>

      {/* ── Desktop: 2-column split ── */}
      <div className="hidden lg:flex lg:max-w-[1100px] lg:mx-auto lg:px-6 lg:pt-6 lg:gap-4"
        style={{ minHeight: 'calc(100vh - 64px)', alignItems: 'flex-start' }}>

        {/* List panel */}
        <div className="w-[340px] shrink-0 rounded-2xl overflow-hidden flex flex-col sticky top-[80px]"
          style={{ maxHeight: 'calc(100vh - 96px)', background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0"
            style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
            <h1 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'الرسائل' : 'Messages'}
            </h1>
            <div className="flex items-center gap-2">
              {tab === 'dms' && (
                <div className="flex items-center overflow-hidden rounded-full transition-all duration-300"
                  style={{ background: searchOpen ? 'var(--tr-overlay)' : 'transparent', border: searchOpen ? '1px solid var(--tr-border-soft)' : '1px solid transparent', width: searchOpen ? 140 : 32, height: 32 }}>
                  <button onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
                    className="shrink-0 w-8 h-8 flex items-center justify-center transition"
                    style={{ color: searchOpen ? BLUE : 'var(--tr-text-muted)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  </button>
                  {searchOpen && (
                    <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder={isRtl ? 'ابحث...' : 'Search...'} className="flex-1 bg-transparent text-xs outline-none pe-2"
                      style={{ color: 'var(--tr-text-primary)' }} />
                  )}
                </div>
              )}
              {tab === 'groups' && (
                <button onClick={() => setShowCreateGroup(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition"
                  style={{ background: BLUE, color: '#fff' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1 p-2 shrink-0" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
            <button style={tabStyle(tab === 'dms')} onClick={() => setTab('dms')}>
              {isRtl ? 'الرسائل' : 'Chats'}
              {hasUnread && (
                <span className="ms-1.5 inline-flex w-4 h-4 rounded-full text-[9px] font-black items-center justify-center"
                  style={{ background: BLUE, color: '#fff' }}>&bull;</span>
              )}
            </button>
            <button style={tabStyle(tab === 'groups')} onClick={() => setTab('groups')}>
              {isRtl ? 'المجموعات' : 'Groups'}
            </button>
            <button style={tabStyle(tab === 'requests')} onClick={() => setTab('requests')}>
              {isRtl ? 'طلبات' : 'Requests'}
              {hasRequests && (
                <span className="ms-1.5 inline-flex w-4 h-4 rounded-full text-[9px] font-black items-center justify-center"
                  style={{ background: '#e74c3c', color: '#fff' }}>{msgRequests.length > 9 ? '9+' : msgRequests.length}</span>
              )}
            </button>
          </div>
          <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            {conversationList}
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 rounded-2xl flex flex-col items-center justify-center sticky top-[80px]"
          style={{ minHeight: 'calc(100vh - 96px)', background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
          <div className="w-16 h-16 mb-4 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: BLUE_SOFT }}>💬</div>
          <p className="font-black text-base" style={{ color: 'var(--tr-text-muted)', opacity: 0.45 }}>
            {isRtl ? 'اختر محادثة' : 'Select a conversation'}
          </p>
        </div>
      </div>

      {/* ── Mobile: single column ── */}
      <div className="lg:hidden">
        {/* Compact header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tab === 'dms' && (
              <div className="flex items-center overflow-hidden rounded-full transition-all duration-300"
                style={{ background: searchOpen ? 'var(--tr-overlay)' : BLUE_SOFT, border: `1px solid ${searchOpen ? 'var(--tr-border-soft)' : BLUE_SOFT}`, width: searchOpen ? 190 : 36, height: 36 }}>
                <button onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
                  className="shrink-0 w-9 h-9 flex items-center justify-center transition" style={{ color: BLUE }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                </button>
                {searchOpen && (
                  <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? 'ابحث في الرسائل...' : 'Search...'}
                    className="flex-1 bg-transparent text-sm outline-none pe-3"
                    style={{ color: 'var(--tr-text-primary)' }} />
                )}
              </div>
            )}
            {tab === 'groups' && (
              <button onClick={() => setShowCreateGroup(true)}
                className="flex items-center gap-1.5 text-[13px] font-bold px-4 py-2 rounded-full transition"
                style={{ background: BLUE, color: '#fff' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {isRtl ? 'مجموعة' : 'Group'}
              </button>
            )}
          </div>
          <h1 className="font-black text-xl" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'الرسائل' : 'Messages'}
          </h1>
        </div>

        {/* Segmented tab control */}
        <div className="px-4 pb-3">
          <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--tr-overlay)' }}>
            <button style={tabStyle(tab === 'dms')} onClick={() => setTab('dms')}>
              {isRtl ? 'الرسائل' : 'Chats'}
              {hasUnread && (
                <span className="ms-1.5 inline-flex w-4 h-4 rounded-full text-[9px] font-black items-center justify-center"
                  style={{ background: BLUE, color: '#fff' }}>&bull;</span>
              )}
            </button>
            <button style={tabStyle(tab === 'groups')} onClick={() => setTab('groups')}>
              {isRtl ? 'المجموعات' : 'Groups'}
            </button>
            <button style={tabStyle(tab === 'requests')} onClick={() => setTab('requests')}>
              {isRtl ? 'طلبات' : 'Requests'}
              {hasRequests && (
                <span className="ms-1.5 inline-flex w-4 h-4 rounded-full text-[9px] font-black items-center justify-center"
                  style={{ background: '#e74c3c', color: '#fff' }}>{msgRequests.length > 9 ? '9+' : msgRequests.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* List — bottom padding accounts for global bottom nav */}
        <div style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
          {conversationList}
        </div>
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(groupId) => { loadAll(); if (groupId) router.push(`/tareeq/groups/${groupId}`); }}
        />
      )}

      {/* Notebook FAB */}
      {user && (
        <>
          <button
            onClick={() => setShowNotebook(true)}
            className="fixed z-40 flex items-center justify-center rounded-2xl shadow-lg transition-all active:scale-95 hover:scale-105"
            style={{
              right: 16,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
              width: 48, height: 48,
              background: 'var(--tr-surface)',
              border: '1px solid var(--tr-gold-dim)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18), 0 0 0 1px var(--tr-gold-dim)',
              color: 'var(--tr-gold)',
            }}
            title={isRtl ? 'دفتري' : 'My Notebook'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75H7.5A2.25 2.25 0 005.25 6v12A2.25 2.25 0 007.5 20.25h9a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0016.5 3.75z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5M8.25 10.5h7.5M8.25 13.5h4.5"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 3.75v3.75a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75V3.75"/>
            </svg>
          </button>
          {showNotebook && <TareeqNotebookPopup onClose={() => setShowNotebook(false)} />}
        </>
      )}
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
