'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import { compressImage } from '@/lib/compress-image';

interface Member { role: string; user: { id: string; name: string; avatarUrl?: string | null } }
interface GroupInfo { id: string; name: string; imageUrl?: string | null; description?: string | null; createdBy: string; members: Member[] }
interface GroupMessage {
  id: string; content: string; imageUrl?: string | null; videoUrl?: string | null;
  createdAt: string; senderId: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
}
interface UserResult { id: string; name: string; avatarUrl?: string | null }
interface SidebarGroup { id: string; name: string; imageUrl?: string | null; lastMessage?: string | null; lastMessageAt?: string | null; memberCount: number }

interface MsgGroup {
  senderId: string; mine: boolean; msgs: GroupMessage[];
  senderInfo: { name: string; avatarUrl?: string | null };
}

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

function groupMessages(messages: GroupMessage[], myId: string): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const m of messages) {
    const mine = m.senderId === myId;
    const last = groups[groups.length - 1];
    if (last && last.senderId === m.senderId) { last.msgs.push(m); }
    else { groups.push({ senderId: m.senderId, mine, msgs: [m], senderInfo: m.sender }); }
  }
  return groups;
}

function formatTime(dateStr: string) {
  try { return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ''; }
}

function formatDay(dateStr: string, isRtl: boolean) {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return isRtl ? 'اليوم' : 'Today';
    if (d.toDateString() === yesterday.toDateString()) return isRtl ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(isRtl ? 'ar' : 'en', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

// ── Add Member Sheet ──────────────────────────────────────────────────
function AddMemberSheet({ groupId, existingIds, onClose, onAdded }: {
  groupId: string; existingIds: Set<string>; onClose: () => void; onAdded: () => void;
}) {
  const { isRtl } = useLang();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tareeq/users/search?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' });
        const d = await res.json();
        setResults(d.users ?? []);
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  async function addMember(userId: string) {
    setAdding(userId);
    try {
      const res = await fetch(`/api/tareeq/groups/${groupId}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ userId }),
      });
      if (res.ok) { setAdded(prev => new Set([...prev, userId])); onAdded(); }
    } catch { /* ignore */ } finally { setAdding(null); }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', maxHeight: '70dvh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'إضافة عضو' : 'Add Member'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm"
            style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>×</button>
        </div>
        <div className="relative">
          <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder={isRtl ? 'ابحث بالاسم...' : 'Search by name...'}
            className="w-full rounded-xl ps-9 pe-4 py-2.5 text-sm outline-none"
            style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
          />
          {searching && (
            <div className="absolute top-1/2 -translate-y-1/2 end-3 w-3.5 h-3.5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: BLUE }} />
          )}
        </div>
        <div className="overflow-y-auto flex flex-col gap-2">
          {results.length === 0 && q.length >= 2 && !searching && (
            <p className="text-center text-sm py-4" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'لا نتائج' : 'No results'}
            </p>
          )}
          {results.map(u => {
            const isExisting = existingIds.has(u.id);
            const isAdded = added.has(u.id);
            const isLoading = adding === u.id;
            return (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--tr-overlay)' }}>
                <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
                  style={{ background: 'var(--tr-raised)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                </div>
                <p className="flex-1 font-semibold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{u.name}</p>
                {isExisting || isAdded ? (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ background: BLUE_SOFT, color: BLUE }}>
                    {isRtl ? '✓ عضو' : '✓ Added'}
                  </span>
                ) : (
                  <button onClick={() => addMember(u.id)} disabled={isLoading}
                    className="text-xs font-bold px-3 py-1.5 rounded-full transition disabled:opacity-50"
                    style={{ background: BLUE, color: '#fff' }}>
                    {isLoading ? '...' : (isRtl ? 'إضافة' : 'Add')}
                  </button>
                )}
              </div>
            );
          })}
          {q.length < 2 && (
            <p className="text-center text-sm py-6" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'اكتب اسم الشخص للبحث' : 'Type a name to search'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Desktop create-group modal ────────────────────────────────────────
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
        credentials: 'include', body: JSON.stringify({ name: name.trim() }),
      });
      const d = await res.json();
      if (res.ok) { onCreated(d.group?.id ?? ''); onClose(); }
      else setError(d.error || (isRtl ? 'حدث خطأ' : 'Error'));
    } catch { setError(isRtl ? 'خطأ في الاتصال' : 'Connection error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl p-6 flex flex-col gap-4"
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
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={isRtl ? 'اسم المجموعة' : 'Group name'} autoFocus maxLength={50}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
        />
        <button onClick={submit} disabled={loading || !name.trim()}
          className="w-full py-3 rounded-xl font-black text-sm transition disabled:opacity-40"
          style={{ background: BLUE, color: '#fff' }}>
          {loading ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء المجموعة' : 'Create Group')}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
function Inner({ groupId }: { groupId: string }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [sidebarGroups, setSidebarGroups] = useState<SidebarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const myId = user?.id ?? '';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/tareeq/groups/${groupId}`, { credentials: 'include' });
      if (res.status === 403 || res.status === 404) { router.push('/tareeq/inbox'); return; }
      if (res.ok) {
        const d = await res.json();
        setGroup(d.group ?? null);
        const msgs: GroupMessage[] = d.messages ?? [];
        setMessages(msgs);
        latestIdRef.current = msgs.length ? msgs[msgs.length - 1].id : '';
      }
    } catch { /* ignore */ } finally { if (!silent) setLoading(false); }
  }, [groupId, router]);

  // Fetch sidebar groups list (desktop only, but always so state is ready)
  useEffect(() => {
    fetch('/api/tareeq/groups', { credentials: 'include' })
      .then(r => r.json()).then(d => setSidebarGroups(d.groups ?? [])).catch(() => {});
  }, [groupId]);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    load();
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/tareeq/groups/${groupId}`, { credentials: 'include' }).catch(() => null);
      if (!res || !res.ok) return;
      const d = await res.json();
      const msgs: GroupMessage[] = d.messages ?? [];
      const newLatest = msgs.length ? msgs[msgs.length - 1].id : '';
      if (newLatest !== latestIdRef.current) { setMessages(msgs); latestIdRef.current = newLatest; }
    }, 8_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [user, router, load, groupId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalPreview(null); setMediaUrl(null); setMediaType(null); setUploadProgress(0);
    if (file.type.startsWith('image/')) setLocalPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const isImage = file.type.startsWith('image/');
      const uploadFile = isImage ? await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 }) : file;
      const form = new FormData(); form.append('file', uploadFile);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/tareeq/upload'); xhr.withCredentials = true;
        xhr.upload.onprogress = ev => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) { setMediaUrl(data.url); setMediaType(data.type); setUploadProgress(100); resolve(); }
            else { setSendError(data.error || 'فشل رفع الملف'); reject(); }
          } catch { setSendError('فشل رفع الملف'); reject(); }
        };
        xhr.onerror = () => { setSendError('فشل رفع الملف'); reject(); };
        xhr.send(form);
      });
    } catch { /* error set */ } finally { setUploading(false); e.target.value = ''; }
  }

  async function handleSend() {
    if ((!input.trim() && !mediaUrl) || sending || uploading) return;
    setSending(true); setSendError('');
    try {
      const res = await fetch(`/api/tareeq/groups/${groupId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ content: input.trim(), imageUrl: mediaType === 'image' ? mediaUrl : null, videoUrl: mediaType === 'video' ? mediaUrl : null }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.message) {
          setMessages(prev => { const updated = [...prev, d.message as GroupMessage]; latestIdRef.current = d.message.id; return updated; });
        }
        setInput(''); setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0);
      } else {
        const d = await res.json().catch(() => ({}));
        setSendError(d.error || 'فشل الإرسال');
      }
    } catch { setSendError('خطأ في الشبكة'); } finally { setSending(false); }
  }

  const isAdmin = group?.members.find(m => m.user.id === myId)?.role === 'admin';
  const existingMemberIds = new Set(group?.members.map(m => m.user.id) ?? []);

  const msgGroups = groupMessages(messages, myId);
  const dayBuckets: { day: string; groups: MsgGroup[] }[] = [];
  for (const g of msgGroups) {
    const day = g.msgs[0].createdAt.slice(0, 10);
    const last = dayBuckets[dayBuckets.length - 1];
    if (last && last.day === day) last.groups.push(g);
    else dayBuckets.push({ day, groups: [g] });
  }

  // ── Single-render layout (sidebar CSS-hidden on mobile, chat panel exists once so refs are reliable) ──
  const chatPanel = (
    <div className="flex flex-col overflow-hidden" style={{ height: '100%', minHeight: 0 }}>
      {/* Sub-header */}
      <div className="px-4 py-2.5 flex items-center gap-3 shrink-0"
        style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
        <button onClick={() => router.push('/tareeq/inbox')}
          className="transition lg:hidden" style={{ color: 'var(--tr-text-muted)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
        {group && (
          <button className="flex items-center gap-3 flex-1 min-w-0 text-start" onClick={() => setShowMembers(v => !v)}>
            <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
              style={{ background: BLUE_SOFT, border: `1.5px solid ${BLUE_SOFT}` }}>
              {group.imageUrl
                ? <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                : <span style={{ fontSize: 16 }}>👥</span>
              }
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] leading-tight truncate" style={{ color: 'var(--tr-text-primary)' }}>{group.name}</p>
              <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
                {group.members.length} {isRtl ? 'أعضاء' : 'members'}
              </p>
            </div>
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setShowAddMember(true)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition active:scale-90"
            style={{ background: BLUE_SOFT, color: BLUE }}
            title={isRtl ? 'إضافة عضو' : 'Add member'}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </button>
        )}
      </div>

      {/* Members strip */}
      {showMembers && group && (
        <div className="shrink-0 px-4 py-3 overflow-x-auto"
          style={{ background: 'var(--tr-overlay)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <div className="flex gap-4">
            {group.members.map(m => (
              <div key={m.user.id} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm relative"
                  style={{ background: 'var(--tr-surface)', color: 'var(--tr-text-muted)', border: '1.5px solid var(--tr-border-soft)' }}>
                  {m.user.avatarUrl
                    ? <img src={m.user.avatarUrl} alt={m.user.name} className="w-full h-full object-cover" />
                    : m.user.name.charAt(0)
                  }
                  {m.role === 'admin' && (
                    <span className="absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px]"
                      style={{ background: BLUE, color: '#fff' }}>★</span>
                  )}
                </div>
                <span className="text-[11px] font-medium max-w-[52px] text-center truncate" style={{ color: 'var(--tr-text-muted)' }}>
                  {m.user.name.split(' ')[0]}
                </span>
              </div>
            ))}
            {isAdmin && (
              <button onClick={() => { setShowMembers(false); setShowAddMember(true); }}
                className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--tr-surface)', border: `1.5px dashed ${BLUE}`, color: BLUE }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-[11px] font-medium" style={{ color: BLUE }}>
                  {isRtl ? 'إضافة' : 'Add'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 max-w-2xl w-full mx-auto" dir="ltr"
        style={{ paddingBottom: 80 }}>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: BLUE }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center" style={{ paddingTop: '20dvh' }}>
            <div className="w-14 h-14 mb-3 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: BLUE_SOFT }}>💬</div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'ابدأ المحادثة في المجموعة' : 'Start the group conversation'}
            </p>
            {isAdmin && group && group.members.length < 2 && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'أضف أعضاء من الزر أعلاه ↑' : 'Add members using the button above ↑'}
              </p>
            )}
          </div>
        ) : (
          dayBuckets.map(bucket => (
            <div key={bucket.day}>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
                <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--tr-text-muted)' }}>
                  {formatDay(bucket.day + 'T12:00:00', isRtl)}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
              </div>
              {bucket.groups.map((grp, gi) => (
                <div key={gi} className="flex flex-col mb-2 w-full">
                  {!grp.mine && (
                    <p className="text-[10px] font-semibold mb-0.5 px-8" style={{ color: BLUE }}>
                      {grp.senderInfo.name}
                    </p>
                  )}
                  {grp.msgs.map((m, mi) => {
                    const isLast = mi === grp.msgs.length - 1;
                    const mineRadius = isLast ? '18px 18px 4px 18px' : '18px';
                    const otherRadius = isLast ? '18px 18px 18px 4px' : '18px';
                    return (
                      <div key={m.id} className={`flex items-end gap-2 mb-0.5 ${grp.mine ? 'justify-end' : 'justify-start'}`}>
                        <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
                          style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', border: '1px solid var(--tr-border-soft)', visibility: (!grp.mine && isLast) ? 'visible' : 'hidden' }}>
                          {!grp.mine && isLast && (grp.senderInfo.avatarUrl
                            ? <img src={grp.senderInfo.avatarUrl} alt="" className="w-full h-full object-cover" />
                            : grp.senderInfo.name.charAt(0)
                          )}
                        </div>
                        <div className="max-w-[72%]"
                          style={{
                            background: grp.mine ? `linear-gradient(160deg, #1356bd, #1c72e8)` : 'var(--tr-raised)',
                            color: grp.mine ? '#fff' : 'var(--tr-text-primary)',
                            ...(grp.mine ? {} : { border: '1px solid var(--tr-border-soft)' }),
                            borderRadius: grp.mine ? mineRadius : otherRadius,
                          }}>
                          {m.imageUrl && <img src={m.imageUrl} alt="" className="w-full max-w-xs rounded-xl object-cover" style={{ maxHeight: 220 }} />}
                          {m.videoUrl && <video src={m.videoUrl} className="w-full max-w-xs rounded-xl" style={{ maxHeight: 220 }} controls playsInline />}
                          {m.content && (
                            <p className="px-3.5 py-2.5 text-sm leading-relaxed" style={{ wordBreak: 'break-word' }} dir="auto">
                              {m.content}
                            </p>
                          )}
                          {!m.content && (m.imageUrl || m.videoUrl) && <div className="px-1 py-1" />}
                        </div>
                      </div>
                    );
                  })}
                  <p className={`text-[10px] mt-1 px-2 ${grp.mine ? 'text-end' : 'text-start'}`}
                    style={{ color: 'var(--tr-text-muted)' }}>
                    {formatTime(grp.msgs[grp.msgs.length - 1].createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0" style={{ background: 'var(--tr-surface)', borderTop: '1px solid var(--tr-border-subtle)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-2xl mx-auto px-3 py-2 flex flex-col gap-2">
          {sendError && <p className="text-xs text-center font-semibold" style={{ color: '#f43f5e' }}>{sendError}</p>}
          {(localPreview || mediaUrl || uploading) && (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden" style={{ border: '1px solid var(--tr-border-soft)' }}>
              {localPreview && mediaType !== 'video'
                ? <img src={localPreview} alt="" className="w-full h-full object-cover" />
                : mediaUrl ? (mediaType === 'image'
                    ? <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                    : <video src={mediaUrl} className="w-full h-full object-cover" />)
                  : <div className="w-full h-full" style={{ background: 'var(--tr-overlay)' }} />
              }
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-black"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{uploadProgress}%</div>
              )}
              {!uploading && (
                <button onClick={() => { setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0); }}
                  className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>×</button>
              )}
            </div>
          )}
          <div className="flex items-end gap-2" dir={isRtl ? 'rtl' : 'ltr'}>
            <label className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition active:scale-90"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
              <svg className="w-4.5 h-4.5" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <input ref={fileInputRef} type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="hidden" disabled={uploading} onChange={handleMedia} />
            </label>
            <div className="flex flex-1 items-center rounded-full px-3 gap-2"
              style={{ background: 'var(--tr-overlay)', border: '1.5px solid var(--tr-border-soft)', minHeight: 44 }}>
              <textarea ref={textareaRef} value={input}
                onChange={e => { setInput(e.target.value); if (sendError) setSendError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isRtl ? 'رسالة...' : 'Message...'}
                rows={1} className="flex-1 bg-transparent border-none focus:outline-none text-sm resize-none py-2.5"
                style={{ color: 'var(--tr-text-primary)', maxHeight: '100px', overflowY: 'auto' }}
              />
            </div>
            <button onClick={handleSend} disabled={sending || uploading || (!input.trim() && !mediaUrl)}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition disabled:opacity-40 active:scale-90"
              style={{ background: BLUE, color: '#fff', boxShadow: `0 4px 16px ${BLUE_SOFT}` }}>
              {sending
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--tr-base)', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Spacer for global Tareeq header on mobile */}
      <div className="h-[60px] shrink-0 lg:hidden" />

      {/* ── Unified layout: sidebar CSS-hidden on mobile, chat panel rendered once ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden lg:max-w-[1100px] lg:w-full lg:mx-auto lg:px-6 lg:pt-6 lg:gap-4">

        {/* Groups sidebar — desktop only via CSS */}
        <aside className="hidden lg:flex flex-col w-[300px] shrink-0 rounded-2xl overflow-hidden"
          style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', maxHeight: 'calc(100dvh - 96px)', alignSelf: 'flex-start', position: 'sticky', top: 80 }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0"
            style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
            <h2 className="font-black text-[14px]" style={{ color: 'var(--tr-text-primary)' }}>
              {isRtl ? 'المجموعات' : 'Groups'}
            </h2>
            <button onClick={() => setShowCreateGroup(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full transition"
              style={{ background: BLUE, color: '#fff' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            {sidebarGroups.length === 0 ? (
              <div className="flex flex-col items-center py-10 px-4">
                <span className="text-2xl mb-2">👥</span>
                <p className="text-[13px] text-center" style={{ color: 'var(--tr-text-muted)' }}>
                  {isRtl ? 'لا مجموعات بعد' : 'No groups yet'}
                </p>
              </div>
            ) : (
              sidebarGroups.map((g, idx) => (
                <Link key={g.id} href={`/tareeq/groups/${g.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors"
                  style={{
                    background: g.id === groupId ? BLUE_ROW : 'transparent',
                    borderBottom: idx < sidebarGroups.length - 1 ? '1px solid var(--tr-border-subtle)' : 'none',
                    borderInlineStart: g.id === groupId ? `3px solid ${BLUE}` : '3px solid transparent',
                  }}>
                  <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: BLUE_SOFT, fontSize: 16 }}>
                    {g.imageUrl
                      ? <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" />
                      : '👥'
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate"
                      style={{ color: g.id === groupId ? BLUE : 'var(--tr-text-primary)' }}>{g.name}</p>
                    <p className="text-[12px] truncate" style={{ color: 'var(--tr-text-muted)' }}>
                      {g.lastMessage || (isRtl ? `${g.memberCount} أعضاء` : `${g.memberCount} members`)}
                    </p>
                  </div>
                  {g.lastMessageAt && (
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--tr-text-muted)' }}>
                      {timeAgo(g.lastMessageAt, isRtl)}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </aside>

        {/* Chat panel — single instance, wraps with lg styles on desktop */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden lg:rounded-2xl"
          style={{ background: 'var(--tr-surface)' }}>
          {chatPanel}
        </div>
      </div>

      {showAddMember && group && (
        <AddMemberSheet groupId={groupId} existingIds={existingMemberIds}
          onClose={() => setShowAddMember(false)} onAdded={() => load(true)} />
      )}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(newGroupId) => { setSidebarGroups([]); fetch('/api/tareeq/groups', { credentials: 'include' }).then(r => r.json()).then(d => setSidebarGroups(d.groups ?? [])).catch(() => {}); if (newGroupId) router.push(`/tareeq/groups/${newGroupId}`); }}
        />
      )}
    </div>
  );
}

export default function TareeqGroupClient({ groupId }: { groupId: string }) {
  return (
    <TareeqNotificationsProvider>
      <Inner groupId={groupId} />
    </TareeqNotificationsProvider>
  );
}
