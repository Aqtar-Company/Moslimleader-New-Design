'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
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

interface MsgGroup {
  senderId: string; mine: boolean; msgs: GroupMessage[];
  senderInfo: { name: string; avatarUrl?: string | null };
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

// ── Add Member Sheet ─────────────────────────────────────────────────
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
      } catch { /* ignore */ }
      finally { setSearching(false); }
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
    } catch { /* ignore */ }
    finally { setAdding(null); }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl p-5 flex flex-col gap-4" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', maxHeight: '70dvh' }} onClick={e => e.stopPropagation()}>
        {/* Handle + title */}
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'إضافة عضو' : 'Add Member'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm" style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>×</button>
        </div>

        {/* Search input */}
        <div className="relative">
          <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={isRtl ? 'ابحث بالاسم...' : 'Search by name...'}
            className="w-full rounded-xl ps-9 pe-4 py-2.5 text-sm outline-none"
            style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
          />
          {searching && <div className="absolute top-1/2 -translate-y-1/2 end-3 w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />}
        </div>

        {/* Results */}
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
                <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm" style={{ background: 'var(--tr-raised)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                  {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                </div>
                <p className="flex-1 font-semibold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{u.name}</p>
                {isExisting || isAdded ? (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--tr-teal)' }}>
                    {isRtl ? '✓ عضو' : '✓ Added'}
                  </span>
                ) : (
                  <button
                    onClick={() => addMember(u.id)}
                    disabled={isLoading}
                    className="text-xs font-bold px-3 py-1.5 rounded-full transition disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,var(--tr-gold-dim),var(--tr-gold-bright))', color: '#fff' }}
                  >
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

// ── Main component ───────────────────────────────────────────────────
function Inner({ groupId }: { groupId: string }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    } catch { /* ignore */ }
    finally { if (!silent) setLoading(false); }
  }, [groupId, router]);

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
    } catch { /* error set */ }
    finally { setUploading(false); e.target.value = ''; }
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
    } catch { setSendError('خطأ في الشبكة'); }
    finally { setSending(false); }
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

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: 'var(--tr-base)', height: '100dvh' }}>
      <TareeqHeader onCreateClick={() => {}} />

      {/* Spacer for both fixed bars: TareeqHeader (h-14=56px) + sub-header (~60px) */}
      <div className="h-[116px] shrink-0" />

      {/* Sub-header — fixed below TareeqHeader so keyboard never hides it */}
      <div className="fixed top-14 left-0 right-0 px-4 py-3 flex items-center gap-3 z-40" style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
        <button onClick={() => router.push('/tareeq/inbox')} className="transition" style={{ color: 'var(--tr-text-muted)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
        {group && (
          <button className="flex items-center gap-3 flex-1 min-w-0 text-start" onClick={() => setShowMembers(v => !v)}>
            <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
              {group.imageUrl ? <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" /> : group.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--tr-text-primary)' }}>{group.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>
                {group.members.length} {isRtl ? 'أعضاء' : 'members'}
              </p>
            </div>
          </button>
        )}
        {/* Add member button — admin only */}
        {isAdmin && (
          <button
            onClick={() => setShowAddMember(true)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition active:scale-90"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)' }}
            title={isRtl ? 'إضافة عضو' : 'Add member'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </button>
        )}
      </div>

      {/* Members strip (tap header to toggle) */}
      {showMembers && group && (
        <div className="shrink-0 px-4 py-3 overflow-x-auto" style={{ background: 'var(--tr-raised)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <div className="flex gap-3">
            {group.members.map(m => (
              <div key={m.user.id} className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm relative" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                  {m.user.avatarUrl ? <img src={m.user.avatarUrl} alt={m.user.name} className="w-full h-full object-cover" /> : m.user.name.charAt(0)}
                  {m.role === 'admin' && <span className="absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px]" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>★</span>}
                </div>
                <span className="text-[10px] font-medium max-w-[56px] text-center truncate" style={{ color: 'var(--tr-text-muted)' }}>{m.user.name.split(' ')[0]}</span>
              </div>
            ))}
            {/* Add member shortcut inside strip */}
            {isAdmin && (
              <button onClick={() => { setShowMembers(false); setShowAddMember(true); }} className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--tr-overlay)', border: '1.5px dashed var(--tr-gold-dim)', color: 'var(--tr-gold)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <span className="text-[10px] font-medium" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'إضافة' : 'Add'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-28 max-w-2xl w-full mx-auto" dir="ltr">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'var(--tr-overlay)' }}>💬</div>
            <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
              {isRtl ? 'ابدأ المحادثة في المجموعة' : 'Start the group conversation'}
            </p>
            {isAdmin && group && group.members.length < 2 && (
              <p className="text-xs mt-2" style={{ color: 'var(--tr-text-muted)' }}>
                {isRtl ? 'أضف أعضاء من الزر أعلاه ↑' : 'Add members using the button above ↑'}
              </p>
            )}
          </div>
        ) : (
          dayBuckets.map(bucket => (
            <div key={bucket.day}>
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
                <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--tr-text-muted)' }}>{formatDay(bucket.day + 'T12:00:00', isRtl)}</span>
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
              </div>
              {bucket.groups.map((group, gi) => (
                <div key={gi} className="flex flex-col mb-2 w-full">
                  {!group.mine && (
                    <p className="text-[10px] font-semibold mb-0.5 px-8" style={{ color: 'var(--tr-gold-dim)' }}>{group.senderInfo.name}</p>
                  )}
                  {group.msgs.map((m, mi) => {
                    const isLast = mi === group.msgs.length - 1;
                    const mineStyle = { background: 'linear-gradient(135deg,#115e59,#0d9488)', color: '#fff', borderRadius: isLast ? '18px 18px 4px 18px' : '18px' };
                    const otherStyle = { background: 'var(--tr-raised)', color: 'var(--tr-text-primary)', border: '1px solid var(--tr-border-soft)', borderRadius: isLast ? '18px 18px 18px 4px' : '18px' };
                    return (
                      <div key={m.id} className={`flex items-end gap-2 mb-0.5 ${group.mine ? 'justify-end' : 'justify-start'}`}>
                        <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1px solid var(--tr-gold-dim)', visibility: (!group.mine && isLast) ? 'visible' : 'hidden' }}>
                          {!group.mine && isLast && (group.senderInfo.avatarUrl ? <img src={group.senderInfo.avatarUrl} alt="" className="w-full h-full object-cover" /> : group.senderInfo.name.charAt(0))}
                        </div>
                        <div className="max-w-[72%]" style={group.mine ? mineStyle : otherStyle}>
                          {m.imageUrl && <img src={m.imageUrl} alt="" className="w-full max-w-xs rounded-xl object-cover" style={{ maxHeight: 220 }} />}
                          {m.videoUrl && <video src={m.videoUrl} className="w-full max-w-xs rounded-xl" style={{ maxHeight: 220 }} controls playsInline />}
                          {m.content && <p className="px-4 py-2.5 text-sm leading-relaxed" style={{ wordBreak: 'break-word' }} dir="auto">{m.content}</p>}
                          {!m.content && (m.imageUrl || m.videoUrl) && <div className="px-1 py-1" />}
                        </div>
                      </div>
                    );
                  })}
                  <p className={`text-[10px] mt-1 px-2 ${group.mine ? 'text-end' : 'text-start'}`} style={{ color: 'var(--tr-text-muted)' }}>
                    {formatTime(group.msgs[group.msgs.length - 1].createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30" style={{ background: 'var(--tr-surface)', borderTop: '1px solid var(--tr-border-subtle)' }}>
        <div className="max-w-2xl mx-auto px-3 py-2 flex flex-col gap-2">
          {sendError && <p className="text-xs text-center font-semibold" style={{ color: '#f43f5e' }}>{sendError}</p>}
          {(localPreview || mediaUrl || uploading) && (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden" style={{ border: '1px solid var(--tr-border-soft)' }}>
              {localPreview && mediaType !== 'video'
                ? <img src={localPreview} alt="" className="w-full h-full object-cover" />
                : mediaUrl
                  ? mediaType === 'image'
                    ? <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                    : <video src={mediaUrl} className="w-full h-full object-cover" />
                  : <div className="w-full h-full" style={{ background: 'var(--tr-overlay)' }} />
              }
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-black" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--tr-gold-bright)' }}>{uploadProgress}%</div>
              )}
              {!uploading && (
                <button onClick={() => { setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0); }} className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>×</button>
              )}
            </div>
          )}
          <div className="flex items-end gap-2" dir={isRtl ? 'rtl' : 'ltr'}>
            <label className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" disabled={uploading} onChange={handleMedia} />
            </label>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); if (sendError) setSendError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isRtl ? 'رسالة...' : 'Message...'}
              rows={1}
              className="flex-1 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none transition"
              style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)', maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || uploading || (!input.trim() && !mediaUrl)}
              className="rounded-full w-9 h-9 flex items-center justify-center shrink-0 transition disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,var(--tr-gold-dim),var(--tr-gold-bright))', color: '#fff' }}
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Add member sheet */}
      {showAddMember && group && (
        <AddMemberSheet
          groupId={groupId}
          existingIds={existingMemberIds}
          onClose={() => setShowAddMember(false)}
          onAdded={() => load(true)}
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
