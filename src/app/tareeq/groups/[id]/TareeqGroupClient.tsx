'use client';
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import { compressImage } from '@/lib/compress-image';

// ── Interfaces ────────────────────────────────────────────────────────
interface Member { role: string; user: { id: string; name: string; avatarUrl?: string | null } }
interface GroupInfo {
  id: string; name: string; imageUrl?: string | null; description?: string | null;
  createdBy: string; members: Member[];
}
interface GroupMessage {
  id: string; content: string;
  imageUrl?: string | null; videoUrl?: string | null; audioUrl?: string | null;
  createdAt: string; senderId: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
}
interface UserResult { id: string; name: string; avatarUrl?: string | null }
interface SidebarGroup { id: string; name: string; imageUrl?: string | null; lastMessage?: string | null; lastMessageAt?: string | null; memberCount: number }
interface MsgGroup {
  senderId: string; mine: boolean; msgs: GroupMessage[];
  senderInfo: { name: string; avatarUrl?: string | null };
}

// ── Constants ─────────────────────────────────────────────────────────
const BLUE      = '#1a6ed4';
const BLUE_SOFT = 'rgba(26,110,212,0.10)';
const BLUE_ROW  = 'rgba(26,110,212,0.055)';

// One active group audio at a time
let activeGroupAudioEl: HTMLAudioElement | null = null;

// ── Helpers ───────────────────────────────────────────────────────────
function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)      return isRtl ? 'الآن'                      : 'now';
  if (diff < 3600)    return isRtl ? `${Math.floor(diff/60)} د`   : `${Math.floor(diff/60)}m`;
  if (diff < 86400)   return isRtl ? `${Math.floor(diff/3600)} س` : `${Math.floor(diff/3600)}h`;
  if (diff < 86400*2) return isRtl ? 'أمس'                        : 'Yesterday';
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

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ── VoiceGroupMessage ─────────────────────────────────────────────────
function VoiceGroupMessage({ url, mine }: { url: string; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [curTime, setCurTime] = useState(0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triedRef = useRef(false);

  const bars = useMemo(() => {
    let h = url.split('').reduce((a, c) => ((a * 31 + c.charCodeAt(0)) | 0), 0x811c9dc5);
    return Array.from({ length: 24 }, () => {
      h ^= h << 13; h ^= h >> 7; h ^= h << 17;
      return 0.15 + (Math.abs(h) % 85) / 100;
    });
  }, [url]);

  useEffect(() => {
    const a = new Audio();
    a.src = url; a.preload = 'metadata';
    audioRef.current = a;
    a.onloadedmetadata = () => {
      if (isFinite(a.duration) && a.duration > 0) { setDuration(a.duration); }
      else { a.currentTime = 1e10; }
    };
    let discovered = false;
    a.onseeked = () => {
      if (discovered) return;
      if (!isFinite(a.duration) || a.duration <= 0) {
        discovered = true;
        if (a.currentTime > 0) setDuration(a.currentTime);
        a.currentTime = 0;
      }
    };
    a.ontimeupdate = () => { setCurTime(a.currentTime); setProgress(a.duration > 0 ? a.currentTime / a.duration : 0); };
    a.onpause = () => { if (activeGroupAudioEl === a) activeGroupAudioEl = null; setPlaying(false); };
    a.onended = () => { if (activeGroupAudioEl === a) activeGroupAudioEl = null; setPlaying(false); setProgress(0); setCurTime(0); a.currentTime = 0; };
    a.onerror = () => { if (activeGroupAudioEl === a) activeGroupAudioEl = null; setPlaying(false); if (triedRef.current) setHasError(true); };
    return () => { a.pause(); a.src = ''; if (activeGroupAudioEl === a) activeGroupAudioEl = null; };
  }, [url]);

  function toggle() {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); }
    else {
      if (activeGroupAudioEl && activeGroupAudioEl !== a) activeGroupAudioEl.pause();
      activeGroupAudioEl = a;
      triedRef.current = true;
      setPlaying(true);
      a.play().catch(() => { setPlaying(false); if (activeGroupAudioEl === a) activeGroupAudioEl = null; setHasError(true); });
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current; if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  if (hasError) {
    return (
      <div className="flex items-center gap-2 py-1 px-1" style={{ minWidth: 180 }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: mine ? 'rgba(255,255,255,0.12)' : 'var(--tr-overlay)' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke={mine ? 'rgba(255,255,255,0.55)' : 'var(--tr-text-muted)'} strokeWidth="1.8" strokeLinecap="round"/></svg>
        </div>
        <span style={{ fontSize: 11, color: mine ? 'rgba(255,255,255,0.55)' : 'var(--tr-text-muted)' }}>تعذّر تشغيل الصوت</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-2 px-1" style={{ minWidth: 180, maxWidth: 240 }}>
      <button onClick={toggle} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90"
        style={{ background: mine ? 'rgba(255,255,255,0.20)' : BLUE_SOFT }}>
        {playing
          ? <svg width="13" height="13" fill={mine ? '#fff' : BLUE} viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          : <svg width="13" height="13" fill={mine ? '#fff' : BLUE} viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        }
      </button>
      <div className="flex-1 flex items-center gap-[2px] cursor-pointer relative" onClick={seek} style={{ height: 24 }}>
        <div className="absolute inset-0 rounded-full" style={{ background: mine ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }} />
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 2, height: Math.max(3, h * 22), borderRadius: 2, flexShrink: 0, position: 'relative',
            background: (i / bars.length) < progress ? (mine ? '#fff' : BLUE) : (mine ? 'rgba(255,255,255,0.30)' : 'var(--tr-border-soft)'),
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.45)' : 'var(--tr-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>
        {playing ? fmtDur(curTime) : fmtDur(duration)}
      </span>
    </div>
  );
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
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: BLUE_SOFT, color: BLUE }}>
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

// ── Group Settings Sheet (WhatsApp-style) ─────────────────────────────
function GroupSettingsSheet({ group, myId, isAdmin, onClose, onChanged, onLeft }: {
  group: GroupInfo;
  myId: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const { isRtl } = useLang();
  const [editingField, setEditingField] = useState<'name' | 'desc' | null>(null);
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description ?? '');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveField(field: 'name' | 'desc') {
    setSaving(true); setSaveErr('');
    try {
      const body = field === 'name' ? { name: editName.trim() } : { description: editDesc.trim() };
      const res = await fetch(`/api/tareeq/groups/${group.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      if (res.ok) { setEditingField(null); onChanged(); }
      else { const d = await res.json().catch(() => ({})); setSaveErr(d.error || 'خطأ'); }
    } catch { setSaveErr('خطأ في الاتصال'); } finally { setSaving(false); }
  }

  async function removeMember(userId: string) {
    setRemoving(userId);
    try {
      await fetch(`/api/tareeq/groups/${group.id}/members`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ userId }),
      });
      onChanged();
    } catch { /* ignore */ } finally { setRemoving(null); }
  }

  async function leaveGroup() {
    // Admin must delete the group instead — leaving as admin orphans it
    if (isAdmin) return;
    setLeaving(true);
    try {
      await fetch(`/api/tareeq/groups/${group.id}/members`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ userId: myId }),
      });
      onLeft();
    } catch { setLeaving(false); }
  }

  async function deleteGroup() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tareeq/groups/${group.id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (res.ok) onLeft();
      else setDeleting(false);
    } catch { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-end lg:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div className="w-full max-w-lg lg:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', maxHeight: '85dvh' }}
        onClick={e => e.stopPropagation()}>

        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 lg:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--tr-border-soft)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-2 shrink-0"
          style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <h2 className="font-black text-[15px]" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? 'معلومات المجموعة' : 'Group Info'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>×</button>
        </div>

        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
          {/* Group avatar + identity */}
          <div className="flex flex-col items-center gap-3 px-5 py-5"
            style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-3xl shrink-0"
              style={{ background: BLUE_SOFT, border: `2px solid ${BLUE_SOFT}` }}>
              {group.imageUrl
                ? <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                : '👥'
              }
            </div>

            {/* Name */}
            {editingField === 'name' ? (
              <div className="w-full flex flex-col gap-2">
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                  maxLength={50} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none text-center font-bold"
                  style={{ background: 'var(--tr-overlay)', border: `1.5px solid ${BLUE}`, color: 'var(--tr-text-primary)' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveField('name'); if (e.key === 'Escape') setEditingField(null); }} />
                {saveErr && <p className="text-center text-xs" style={{ color: '#f87171' }}>{saveErr}</p>}
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setEditingField(null)} className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button onClick={() => saveField('name')} disabled={saving || !editName.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-40"
                    style={{ background: BLUE, color: '#fff' }}>
                    {saving ? '...' : (isRtl ? 'حفظ' : 'Save')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-center" style={{ color: 'var(--tr-text-primary)' }}>{group.name}</h3>
                {isAdmin && (
                  <button onClick={() => { setEditingField('name'); setEditName(group.name); setSaveErr(''); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg"
                    style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Description */}
            {editingField === 'desc' ? (
              <div className="w-full flex flex-col gap-2">
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  maxLength={200} rows={3} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: 'var(--tr-overlay)', border: `1.5px solid ${BLUE}`, color: 'var(--tr-text-primary)' }}
                  placeholder={isRtl ? 'وصف المجموعة...' : 'Group description...'}
                />
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setEditingField(null)} className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button onClick={() => saveField('desc')} disabled={saving}
                    className="px-4 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-40"
                    style={{ background: BLUE, color: '#fff' }}>
                    {saving ? '...' : (isRtl ? 'حفظ' : 'Save')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 w-full justify-center">
                <p className="text-sm text-center" style={{ color: 'var(--tr-text-muted)' }}>
                  {group.description || (isAdmin ? (isRtl ? 'أضف وصفاً للمجموعة...' : 'Add a group description...') : '')}
                </p>
                {isAdmin && (
                  <button onClick={() => { setEditingField('desc'); setEditDesc(group.description ?? ''); setSaveErr(''); }}
                    className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md"
                    style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Members section */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? `الأعضاء — ${group.members.length}` : `Members — ${group.members.length}`}
            </p>
            <div className="flex flex-col gap-1">
              {group.members.map(m => {
                const isMe = m.user.id === myId;
                const isCreator = m.user.id === group.createdBy;
                // Admin can remove non-creator members (not themselves via this button)
                const canRemove = isAdmin && !isMe && !isCreator && m.role !== 'admin';
                return (
                  <div key={m.user.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition"
                    style={{ background: 'var(--tr-overlay)' }}>
                    <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
                      style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-muted)', border: '1.5px solid var(--tr-border-soft)' }}>
                      {m.user.avatarUrl
                        ? <img src={m.user.avatarUrl} alt={m.user.name} className="w-full h-full object-cover" />
                        : m.user.name.charAt(0)
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] truncate" style={{ color: 'var(--tr-text-primary)' }}>
                        {m.user.name}{isMe ? ` (${isRtl ? 'أنت' : 'You'})` : ''}
                      </p>
                    </div>
                    {/* Role badge */}
                    {m.role === 'admin' && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: BLUE_SOFT, color: BLUE }}>
                        {isRtl ? 'مسؤول' : 'Admin'}
                      </span>
                    )}
                    {/* Remove button */}
                    {canRemove && (
                      <button
                        onClick={() => removeMember(m.user.id)}
                        disabled={removing === m.user.id}
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40"
                        style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}
                        title={isRtl ? 'إزالة من المجموعة' : 'Remove from group'}>
                        {removing === m.user.id
                          ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave / Delete group */}
          <div className="px-5 py-4 mt-2" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
            {isAdmin ? (
              confirmDelete ? (
                <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <p className="text-sm text-center font-semibold" style={{ color: 'var(--tr-text-primary)' }}>
                    {isRtl ? 'سيتم حذف المجموعة وكل رسائلها نهائياً' : 'Group and all its messages will be permanently deleted'}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button onClick={deleteGroup} disabled={deleting}
                      className="flex-1 py-2.5 rounded-xl text-sm font-black transition disabled:opacity-50"
                      style={{ background: '#ef4444', color: '#fff' }}>
                      {deleting ? '...' : (isRtl ? 'حذف نهائي' : 'Delete')}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-xl text-sm font-semibold transition active:scale-[0.98]"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                  {isRtl ? '🗑️ حذف المجموعة' : '🗑️ Delete Group'}
                </button>
              )
            ) : confirmLeave ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-center font-semibold" style={{ color: 'var(--tr-text-primary)' }}>
                  {isRtl ? 'هل تريد مغادرة المجموعة؟' : 'Leave this group?'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmLeave(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button onClick={leaveGroup} disabled={leaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-black transition disabled:opacity-50"
                    style={{ background: '#ef4444', color: '#fff' }}>
                    {leaving ? '...' : (isRtl ? 'مغادرة' : 'Leave')}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmLeave(true)} className="w-full py-3 rounded-xl text-sm font-semibold transition active:scale-[0.98]"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                {isRtl ? '🚪 مغادرة المجموعة' : '🚪 Leave Group'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create-group modal ────────────────────────────────────────────────
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
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Core state
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [sidebarGroups, setSidebarGroups] = useState<SidebarGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Voice recording
  const [micActive, setMicActive] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const [micError, setMicError] = useState('');
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(0.15));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const micIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledMicRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animAudioCtxRef = useRef<AudioContext | null>(null);

  // UI overlays
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Keyboard offset (iOS visualViewport)
  const [kbOffset, setKbOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !('ontouchstart' in window)) return;
    function onResize() {
      const offset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
      setKbOffset(offset);
    }
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); };
  }, []);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestIdRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const myId = user?.id ?? '';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/tareeq/groups/${groupId}`, { credentials: 'include' });
      if (res.status === 403 || res.status === 404) { router.push('/tareeq/groups'); return; }
      if (res.ok) {
        const d = await res.json();
        setGroup(d.group ?? null);
        const msgs: GroupMessage[] = d.messages ?? [];
        setMessages(msgs);
        latestIdRef.current = msgs.length ? msgs[msgs.length - 1].id : '';
      }
    } catch { /* ignore */ } finally { if (!silent) setLoading(false); }
  }, [groupId, router]);

  useEffect(() => {
    fetch('/api/tareeq/groups', { credentials: 'include' })
      .then(r => r.json()).then(d => setSidebarGroups(d.groups ?? [])).catch(() => {});
  }, [groupId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/tareeq/login'); return; }
    load();
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/tareeq/groups/${groupId}`, { credentials: 'include' }).catch(() => null);
      if (!res || !res.ok) return;
      const d = await res.json();
      const msgs: GroupMessage[] = d.messages ?? [];
      const newLatest = msgs.length ? msgs[msgs.length - 1].id : '';
      if (newLatest !== latestIdRef.current) {
        setMessages(msgs);
        latestIdRef.current = newLatest;
        setGroup(d.group ?? null);
      }
    }, 8_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [authLoading, user, router, load, groupId]);

  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Mic cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledMicRef.current = true;
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      if (micTimerRef.current) clearTimeout(micTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      try { mediaRecorderRef.current?.stop(); } catch { /* already stopped */ }
      animAudioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // ── Mic recording ──
  function stopMicCleanup() {
    if (micIntervalRef.current) { clearInterval(micIntervalRef.current); micIntervalRef.current = null; }
    if (micTimerRef.current) { clearTimeout(micTimerRef.current); micTimerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    analyserRef.current = null;
    animAudioCtxRef.current?.close().catch(() => {});
    animAudioCtxRef.current = null;
    setWaveformBars(Array(20).fill(0.15));
  }

  function cancelMic() {
    cancelledMicRef.current = true;
    mediaRecorderRef.current?.stop();
    stopMicCleanup();
    setMicActive(false);
    setMicSeconds(0);
  }

  async function handleMic() {
    if (micActive) {
      cancelledMicRef.current = false;
      mediaRecorderRef.current?.stop();
      return;
    }

    setMicError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError(isRtl ? 'يرجى السماح بالوصول للميكروفون' : 'Microphone access denied');
      setTimeout(() => setMicError(''), 3000);
      return;
    }

    audioChunksRef.current = [];
    cancelledMicRef.current = false;

    // Real-time waveform
    try {
      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (ACtx) {
        const actx = new ACtx();
        animAudioCtxRef.current = actx;
        const analyser = actx.createAnalyser();
        analyser.fftSize = 128;
        actx.createMediaStreamSource(stream).connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const animate = () => {
          animFrameRef.current = requestAnimationFrame(animate);
          analyser.getByteFrequencyData(data);
          const bars = Array.from({ length: 20 }, (_, i) => {
            const v = data[Math.floor(i * data.length / 20)] / 255;
            return 0.1 + v * 0.9;
          });
          setWaveformBars(bars);
        };
        animate();
      }
    } catch { /* waveform unavailable */ }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg'
      : '';
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      stopMicCleanup();
      setMicActive(false);
      setMicSeconds(0);
      if (cancelledMicRef.current || audioChunksRef.current.length === 0) return;

      const actualMime = mr.mimeType || mimeType || 'audio/webm';
      const ext = actualMime.includes('ogg') ? 'ogg' : actualMime.includes('mp4') ? 'm4a' : 'webm';
      const blob = new Blob(audioChunksRef.current, { type: actualMime });
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: actualMime });

      setUploading(true);
      setUploadProgress(0);
      try {
        const form = new FormData(); form.append('file', file);
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/tareeq/upload'); xhr.withCredentials = true;
          xhr.upload.onprogress = ev => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && data.url) {
                // Send immediately as a voice message
                fetch(`/api/tareeq/groups/${groupId}/messages`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                  body: JSON.stringify({ content: '', audioUrl: data.url }),
                }).then(r => r.ok ? r.json() : null).then(d => {
                  if (d?.message) {
                    setMessages(prev => { const updated = [...prev, d.message as GroupMessage]; latestIdRef.current = d.message.id; return updated; });
                  }
                }).catch(() => {});
                resolve();
              } else { setSendError(data.error || 'فشل رفع الصوت'); reject(); }
            } catch { setSendError('فشل رفع الصوت'); reject(); }
          };
          xhr.onerror = () => { setSendError('فشل رفع الصوت'); reject(); };
          xhr.send(form);
        });
      } catch { /* error set above */ } finally { setUploading(false); setUploadProgress(0); }
    };

    mr.start(250);
    setMicActive(true);
    let secs = 0;
    micIntervalRef.current = setInterval(() => {
      secs++;
      setMicSeconds(secs);
      if (secs >= 120) {
        cancelledMicRef.current = false;
        mediaRecorderRef.current?.stop();
      }
    }, 1000);
  }

  // ── Media attachment ──
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
  const canSend = !!input.trim() || !!mediaUrl;

  const msgGroups = groupMessages(messages, myId);
  const dayBuckets: { day: string; groups: MsgGroup[] }[] = [];
  for (const g of msgGroups) {
    const day = g.msgs[0].createdAt.slice(0, 10);
    const last = dayBuckets[dayBuckets.length - 1];
    if (last && last.day === day) last.groups.push(g);
    else dayBuckets.push({ day, groups: [g] });
  }

  // ── Chat panel (single render — refs are reliable) ────────────────
  const chatPanel = (
    <div className="flex flex-col overflow-hidden" style={{ height: '100%', minHeight: 0 }}>

      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-2.5 shrink-0"
        style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
        {/* Back (mobile) */}
        <button onClick={() => window.history.length > 1 ? router.back() : router.push('/tareeq/groups')}
          className="shrink-0 transition lg:hidden" style={{ color: 'var(--tr-text-muted)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>

        {/* Group info — tap to toggle members strip */}
        {group && (
          <button className="flex items-center gap-2.5 flex-1 min-w-0 text-start" onClick={() => setShowMembers(v => !v)}>
            <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-base"
              style={{ background: BLUE_SOFT, border: `1.5px solid ${BLUE_SOFT}` }}>
              {group.imageUrl ? <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" /> : '👥'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[14px] leading-tight truncate" style={{ color: 'var(--tr-text-primary)' }}>{group.name}</p>
              <p className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>
                {group.members.length} {isRtl ? 'أعضاء' : 'members'}
              </p>
            </div>
          </button>
        )}

        {/* Actions: add member (admin) + settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isAdmin && (
            <button onClick={() => setShowAddMember(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full transition active:scale-90"
              style={{ background: BLUE_SOFT, color: BLUE }}
              title={isRtl ? 'إضافة عضو' : 'Add member'}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </button>
          )}
          <button onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full transition active:scale-90"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}
            title={isRtl ? 'إعدادات المجموعة' : 'Group settings'}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
            </svg>
          </button>
        </div>
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
                  {m.user.avatarUrl ? <img src={m.user.avatarUrl} alt={m.user.name} className="w-full h-full object-cover" /> : m.user.name.charAt(0)}
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
                <span className="text-[11px] font-medium" style={{ color: BLUE }}>{isRtl ? 'إضافة' : 'Add'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 max-w-2xl w-full mx-auto" dir="ltr"
        style={{ paddingBottom: 80 }}>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: BLUE }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center" style={{ paddingTop: '20dvh' }}>
            <div className="w-14 h-14 mb-3 rounded-2xl flex items-center justify-center text-2xl" style={{ background: BLUE_SOFT }}>💬</div>
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
                        {/* Sender avatar */}
                        <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
                          style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', border: '1px solid var(--tr-border-soft)', visibility: (!grp.mine && isLast) ? 'visible' : 'hidden' }}>
                          {!grp.mine && isLast && (grp.senderInfo.avatarUrl
                            ? <img src={grp.senderInfo.avatarUrl} alt="" className="w-full h-full object-cover" />
                            : grp.senderInfo.name.charAt(0)
                          )}
                        </div>
                        {/* Bubble */}
                        <div className="max-w-[72%]"
                          style={{
                            background: grp.mine ? `linear-gradient(160deg, #1356bd, #1c72e8)` : 'var(--tr-raised)',
                            color: grp.mine ? '#fff' : 'var(--tr-text-primary)',
                            ...(grp.mine ? {} : { border: '1px solid var(--tr-border-soft)' }),
                            borderRadius: grp.mine ? mineRadius : otherRadius,
                          }}>
                          {m.audioUrl && <VoiceGroupMessage url={m.audioUrl} mine={grp.mine} />}
                          {m.imageUrl && <img src={m.imageUrl} alt="" className="w-full max-w-xs rounded-xl object-cover" style={{ maxHeight: 220 }} />}
                          {m.videoUrl && <video src={m.videoUrl} className="w-full max-w-xs rounded-xl" style={{ maxHeight: 220 }} controls playsInline />}
                          {m.content && (
                            <p className="px-3.5 py-2.5 text-sm leading-relaxed" style={{ wordBreak: 'break-word' }} dir="auto">
                              {m.content}
                            </p>
                          )}
                          {!m.content && !m.audioUrl && (m.imageUrl || m.videoUrl) && <div className="px-1 py-1" />}
                        </div>
                      </div>
                    );
                  })}
                  <p className={`text-[10px] mt-1 px-2 ${grp.mine ? 'text-end' : 'text-start'}`} style={{ color: 'var(--tr-text-muted)' }}>
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

          {/* Errors */}
          {sendError && <p className="text-xs text-center font-semibold" style={{ color: '#f43f5e' }}>{sendError}</p>}
          {micError  && <p className="text-xs text-center font-semibold" style={{ color: '#f43f5e' }}>{micError}</p>}

          {/* Media preview */}
          {(localPreview || mediaUrl || uploading) && !micActive && (
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

          {/* Voice recording bar */}
          {micActive && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-2xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.15)' }}>
              {/* Waveform */}
              <div className="flex-1 flex items-center gap-[2px]" style={{ height: 28 }}>
                {waveformBars.map((h, i) => (
                  <div key={i} style={{
                    width: 3, height: Math.max(3, h * 26), borderRadius: 3,
                    background: '#ef4444', opacity: 0.6 + h * 0.4, flexShrink: 0,
                    transition: 'height 80ms ease',
                  }} />
                ))}
              </div>
              {/* Timer */}
              <span className="text-sm font-black tabular-nums" style={{ color: '#ef4444', minWidth: 40 }}>
                {fmtDur(micSeconds)}
              </span>
              {/* Cancel */}
              <button onClick={cancelMic}
                className="w-8 h-8 flex items-center justify-center rounded-full transition active:scale-90"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}

          {/* Main input row */}
          <div className="flex items-end gap-2" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Attach image/video */}
            {!micActive && (
              <label className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition active:scale-90"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <input ref={fileInputRef} type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  className="hidden" disabled={uploading} onChange={handleMedia} />
              </label>
            )}

            {/* Text input (hidden while recording) */}
            {!micActive && (
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
            )}

            {/* Send / Mic button */}
            {canSend && !micActive ? (
              <button onClick={handleSend} disabled={sending || uploading}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition disabled:opacity-40 active:scale-90"
                style={{ background: BLUE, color: '#fff', boxShadow: `0 4px 16px ${BLUE_SOFT}` }}>
                {sending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                }
              </button>
            ) : (
              <button
                onClick={handleMic}
                disabled={uploading}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40"
                style={{
                  background: micActive ? '#ef4444' : 'var(--tr-overlay)',
                  color: micActive ? '#fff' : 'var(--tr-text-muted)',
                  boxShadow: micActive ? '0 0 0 4px rgba(239,68,68,0.15)' : 'none',
                }}
                title={micActive ? (isRtl ? 'إرسال' : 'Send') : (isRtl ? 'رسالة صوتية' : 'Voice message')}>
                {micActive ? (
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                ) : (
                  <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm-1 17.93V21h-2v2h6v-2h-2v-2.07A8 8 0 0020 12h-2a6 6 0 01-12 0H4a8 8 0 007 7.93z"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--tr-base)', height: `calc(100dvh - ${kbOffset}px)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="h-14 shrink-0 lg:hidden" />

      <div className="flex-1 min-h-0 flex overflow-hidden lg:max-w-[1100px] lg:w-full lg:mx-auto lg:px-6 lg:pt-6 lg:gap-4">

        {/* Sidebar — desktop only via CSS */}
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
                    {g.imageUrl ? <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" /> : '👥'}
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

        {/* Chat panel — single instance */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden lg:rounded-2xl"
          style={{ background: 'var(--tr-surface)' }}>
          {chatPanel}
        </div>
      </div>

      {/* Overlays */}
      {showAddMember && group && (
        <AddMemberSheet groupId={groupId} existingIds={existingMemberIds}
          onClose={() => setShowAddMember(false)} onAdded={() => load(true)} />
      )}
      {showSettings && group && (
        <GroupSettingsSheet
          group={group}
          myId={myId}
          isAdmin={!!isAdmin}
          onClose={() => setShowSettings(false)}
          onChanged={() => { setShowSettings(false); load(true); }}
          onLeft={() => router.push('/tareeq/inbox')}
        />
      )}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(newGroupId) => {
            setSidebarGroups([]);
            fetch('/api/tareeq/groups', { credentials: 'include' }).then(r => r.json()).then(d => setSidebarGroups(d.groups ?? [])).catch(() => {});
            if (newGroupId) router.push(`/tareeq/groups/${newGroupId}`);
          }}
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
