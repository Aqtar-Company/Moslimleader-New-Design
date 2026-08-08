'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TareeqNotificationsProvider, useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import { compressImage } from '@/lib/compress-image';
import TareeqCallScreen from '@/components/tareeq/TareeqCallScreen';

interface Message {
  id: string;
  content: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  read: boolean;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
}
interface OtherUser { id: string; name: string; avatarUrl?: string | null }

interface MsgGroup {
  senderId: string;
  mine: boolean;
  msgs: Message[];
  senderInfo: { name: string; avatarUrl?: string | null };
}

function groupMessages(messages: Message[], myId: string): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const m of messages) {
    const mine = m.senderId === myId;
    const last = groups[groups.length - 1];
    if (last && last.senderId === m.senderId) {
      last.msgs.push(m);
    } else {
      groups.push({ senderId: m.senderId, mine, msgs: [m], senderInfo: m.sender });
    }
  }
  return groups;
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
}

function formatDay(dateStr: string, isRtl: boolean) {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return isRtl ? 'اليوم' : 'Today';
    if (d.toDateString() === yesterday.toDateString()) return isRtl ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(isRtl ? 'ar' : 'en', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function Inner({ conversationId }: { conversationId: string }) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const { refresh } = useTareeqNotifications();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestIdRef = useRef<string>('');

  // Call state
  const [activeCall, setActiveCall] = useState<{
    callId: string; role: 'caller' | 'callee'; callType: 'audio' | 'video'; offer?: string;
  } | null>(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}`, { credentials: 'include' });
      if (res.status === 403 || res.status === 404) { router.push('/tareeq/inbox'); return; }
      if (res.ok) {
        const d = await res.json();
        const msgs: Message[] = d.messages ?? [];
        setMessages(msgs);
        setOtherUser(d.otherUser ?? null);
        latestIdRef.current = msgs.length ? msgs[msgs.length - 1].id : '';
        refresh();
      }
    } catch { /* ignore */ } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId, router, refresh]);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    loadMessages();
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}`, { credentials: 'include' }).catch(() => null);
      if (!res || !res.ok) return;
      const d = await res.json();
      const msgs: Message[] = d.messages ?? [];
      const newLatest = msgs.length ? msgs[msgs.length - 1].id : '';
      if (newLatest !== latestIdRef.current) {
        setMessages(msgs);
        latestIdRef.current = newLatest;
        refresh();
      }
    }, 10_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [user, router, loadMessages, conversationId, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalPreview(null); setMediaUrl(null); setMediaType(null); setUploadProgress(0);
    if (file.type.startsWith('image/')) {
      setLocalPreview(URL.createObjectURL(file));
    }
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
    } catch { /* error set above */ }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function startCall(callType: 'audio' | 'video') {
    if (!otherUser || !user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(callType === 'video' ? { audio: true, video: true } : { audio: true });
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offerSdp = await pc.createOffer();
      await pc.setLocalDescription(offerSdp);
      stream.getTracks().forEach(t => t.stop());
      pc.close();

      const res = await fetch('/api/tareeq/calls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ calleeId: otherUser.id, type: callType, offer: offerSdp.sdp }),
      });
      if (res.ok) {
        const { callId } = await res.json();
        setActiveCall({ callId, role: 'caller', callType });
      }
    } catch {
      // getUserMedia denied or PC failed — silently ignore (user sees nothing opened)
    }
  }

  async function handleSend() {
    if ((!input.trim() && !mediaUrl) || sending || uploading) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(`/api/tareeq/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: input.trim(),
          imageUrl: mediaType === 'image' ? mediaUrl : null,
          videoUrl: mediaType === 'video' ? mediaUrl : null,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.message) {
          setMessages(prev => { const updated = [...prev, d.message as Message]; latestIdRef.current = d.message.id; return updated; });
        }
        setInput('');
        setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0);
        refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setSendError(d.error || (isRtl ? 'فشل الإرسال' : 'Send failed'));
      }
    } catch {
      setSendError(isRtl ? 'خطأ في الشبكة' : 'Network error');
    } finally {
      setSending(false);
    }
  }

  const myId = user?.id ?? '';
  const groups = groupMessages(messages, myId);

  // Group by day for date separators
  const dayBuckets: { day: string; groups: MsgGroup[] }[] = [];
  for (const g of groups) {
    const day = g.msgs[0].createdAt.slice(0, 10);
    const last = dayBuckets[dayBuckets.length - 1];
    if (last && last.day === day) {
      last.groups.push(g);
    } else {
      dayBuckets.push({ day, groups: [g] });
    }
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: 'var(--tr-base)', height: '100dvh' }}>
      <TareeqHeader onCreateClick={() => {}} />

      {/* Spacer for both fixed bars: TareeqHeader (h-14=56px) + sub-header (~60px) */}
      <div className="h-[116px] shrink-0" />

      {/* Chat sub-header — fixed below TareeqHeader so keyboard never hides it */}
      <div
        className="fixed top-14 left-0 right-0 px-4 py-3 flex items-center gap-3 z-40"
        style={{
          background: 'var(--tr-surface)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--tr-border-subtle)',
        }}
      >
        <button
          onClick={() => router.push('/tareeq/inbox')}
          className="transition"
          style={{ color: 'var(--tr-text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-gold)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-muted)'; }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
        </button>
        {otherUser && (
          <>
            <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
              {otherUser.avatarUrl
                ? <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-full h-full object-cover" />
                : otherUser.name.charAt(0)
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--tr-text-primary)' }}>{otherUser.name}</p>
            </div>
            {/* Call buttons */}
            <div className="flex items-center gap-2 ms-auto">
              <button
                onClick={() => startCall('audio')}
                className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}
                aria-label={isRtl ? 'مكالمة صوتية' : 'Voice call'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </button>
              <button
                onClick={() => startCall('video')}
                className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90"
                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}
                aria-label={isRtl ? 'مكالمة فيديو' : 'Video call'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Messages — dir="ltr" so physical right=sender always, left=receiver always, regardless of UI language */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-24 max-w-2xl w-full mx-auto" dir="ltr">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--tr-text-muted)' }}>
            {isRtl ? 'ابدأ المحادثة' : 'Start the conversation'}
          </div>
        ) : (
          dayBuckets.map(bucket => (
            <div key={bucket.day}>
              {/* Day separator */}
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
                <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--tr-text-muted)' }}>
                  {formatDay(bucket.day + 'T12:00:00', isRtl)}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--tr-border-subtle)' }} />
              </div>

              {bucket.groups.map((group, gi) => (
                <div key={gi} className="flex flex-col mb-2 w-full">
                  {group.msgs.map((m, mi) => {
                    const isLast = mi === group.msgs.length - 1;
                    // Bubble border-radius: tail on last message in group
                    const mineStyle = {
                      background: 'linear-gradient(135deg, #115e59, #0d9488)',
                      color: '#fff',
                      borderRadius: isLast ? '18px 18px 4px 18px' : '18px',
                    };
                    const otherStyle = {
                      background: 'var(--tr-raised)',
                      color: 'var(--tr-text-primary)',
                      border: '1px solid var(--tr-border-soft)',
                      borderRadius: isLast ? '18px 18px 18px 4px' : '18px',
                    };
                    return (
                      <div key={m.id} className={`flex items-end gap-2 mb-0.5 ${group.mine ? 'justify-end' : 'justify-start'}`}>
                        {/* Receiver avatar — only on last message in group */}
                        {!group.mine && (
                          <div
                            className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
                            style={{
                              background: 'var(--tr-overlay)',
                              color: 'var(--tr-gold)',
                              border: '1px solid var(--tr-gold-dim)',
                              visibility: isLast ? 'visible' : 'hidden',
                            }}
                          >
                            {isLast && (group.senderInfo.avatarUrl
                              ? <img src={group.senderInfo.avatarUrl} alt="" className="w-full h-full object-cover" />
                              : group.senderInfo.name.charAt(0)
                            )}
                          </div>
                        )}
                        <div className="max-w-[72%]" style={group.mine ? mineStyle : otherStyle}>
                          {m.imageUrl && <img src={m.imageUrl} alt="" className="w-full max-w-xs rounded-xl object-cover" style={{ maxHeight: 220 }} />}
                          {m.videoUrl && <video src={m.videoUrl} className="w-full max-w-xs rounded-xl" style={{ maxHeight: 220 }} controls playsInline />}
                          {m.content && <p className="px-4 py-2.5 text-sm leading-relaxed" style={{ wordBreak: 'break-word' }} dir="auto">{m.content}</p>}
                          {!m.content && (m.imageUrl || m.videoUrl) && <div className="px-1 py-1" />}
                        </div>
                      </div>
                    );
                  })}
                  {/* Timestamp below group */}
                  <p
                    className={`text-[10px] mt-1 px-2 ${group.mine ? 'text-end' : 'text-start'}`}
                    style={{ color: 'var(--tr-text-muted)' }}
                  >
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

          {/* Media preview strip */}
          {(localPreview || mediaUrl || uploading) && (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden" style={{ border: '1px solid var(--tr-border-soft)' }}>
              {localPreview && mediaType !== 'video'
                ? <img src={localPreview} alt="" className="w-full h-full object-cover" />
                : mediaUrl ? (mediaType === 'image'
                    ? <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                    : <video src={mediaUrl} className="w-full h-full object-cover" />)
                  : <div className="w-full h-full" style={{ background: 'var(--tr-overlay)' }} />
              }
              {uploading && <div className="absolute inset-0 flex items-center justify-center text-xs font-black" style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--tr-gold-bright)' }}>{uploadProgress}%</div>}
              {!uploading && <button onClick={() => { setMediaUrl(null); setMediaType(null); setLocalPreview(null); setUploadProgress(0); }} className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>×</button>}
            </div>
          )}

          <div className="flex items-end gap-2" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Media picker */}
            <label className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full cursor-pointer" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" disabled={uploading} onChange={handleMedia} />
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
              style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#0a0d06' }}
            >
              {sending ? <div className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Active call screen */}
      {activeCall && otherUser && (
        <TareeqCallScreen
          callId={activeCall.callId}
          role={activeCall.role}
          callType={activeCall.callType}
          remoteUser={otherUser}
          offer={activeCall.offer}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}

export default function TareeqConversationClient({ conversationId }: { conversationId: string }) {
  return (
    <TareeqNotificationsProvider>
      <Inner conversationId={conversationId} />
    </TareeqNotificationsProvider>
  );
}
