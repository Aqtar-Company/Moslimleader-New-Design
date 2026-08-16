'use client';
import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTareeqNotifications } from '@/context/TareeqNotificationsContext';
import TareeqCallScreen from '@/components/tareeq/TareeqCallScreen';
import { prewireOutRingPipeline } from '@/lib/tareeq-ring-pipeline';

interface Props {
  onCreateClick: () => void;
  searchInput?: string;
  onSearch?: (v: string) => void;
  onToggleSidebar?: () => void;
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -top-1 -end-1 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none"
      style={{ background: '#f43f5e', color: '#fff' }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

/* ── Types ── */
interface Notification {
  id: string; type: string; actorName?: string | null; postId?: string | null;
  postTitle?: string | null; body?: string | null; read: boolean; createdAt: string;
}
interface OtherUser { id: string; name: string; avatarUrl?: string | null }
interface Conversation {
  id: string; lastMessage?: string | null; lastMessageAt?: string | null;
  unreadCount: number; otherUser: OtherUser;
}
interface ChatMessage {
  id: string; content: string; senderId: string; createdAt: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
}

function timeAgo(iso: string, isRtl: boolean): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return isRtl ? 'الآن' : 'now';
  if (diff < 3600) return isRtl ? `${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return isRtl ? `${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h`;
  return isRtl ? `${Math.floor(diff / 86400)} ي` : `${Math.floor(diff / 86400)}d`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'like') return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(244,63,94,0.12)' }}>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#f43f5e' }}>
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    </div>
  );
  if (type === 'comment') return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(45,212,191,0.10)' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-teal)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--tr-gold-glow)' }}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    </div>
  );
}

export default function TareeqHeader({ onCreateClick, searchInput, onSearch, onToggleSidebar }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname ? usePathname() : '';
  const { notifCount, messageCount } = useTareeqNotifications();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  /* ── Mobile notification panel state ── */
  const [showMobileNotifPanel, setShowMobileNotifPanel] = useState(false);

  /* ── Desktop notification panel state ── */
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifPanelVisible, setNotifPanelVisible] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  /* ── Desktop messages panel state ── */
  const [showMsgPanel, setShowMsgPanel] = useState(false);
  const [msgPanelVisible, setMsgPanelVisible] = useState(false);
  const [panelSize, setPanelSize] = useState({ w: 340, h: 520 });
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 340, h: 520 });
  const panelDraggingRef = useRef(false);
  const panelDragStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  function startPanelDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    e.preventDefault();
    const rect = msgPanelRef.current?.getBoundingClientRect();
    const startPx = rect ? rect.left : Math.max(0, window.innerWidth - panelSize.w - 16);
    const startPy = rect ? rect.top : 72;
    panelDraggingRef.current = true;
    panelDragStartRef.current = { mx: e.clientX, my: e.clientY, px: startPx, py: startPy };
    setPanelPos({ x: startPx, y: startPy });
    function onMove(ev: MouseEvent) {
      if (!panelDraggingRef.current) return;
      const dx = ev.clientX - panelDragStartRef.current.mx;
      const dy = ev.clientY - panelDragStartRef.current.my;
      setPanelPos({
        x: Math.max(0, Math.min(window.innerWidth - panelSize.w, panelDragStartRef.current.px + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, panelDragStartRef.current.py + dy)),
      });
    }
    function onUp() {
      panelDraggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startPanelResize(e: React.MouseEvent) {
    e.preventDefault();
    resizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: panelSize.w, h: panelSize.h };
    const startPos = panelPos ? { ...panelPos } : null;
    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const dx = ev.clientX - resizeStartRef.current.x;
      const dy = ev.clientY - resizeStartRef.current.y;
      const newH = Math.max(300, Math.min(700, resizeStartRef.current.h + dy));
      if (startPos) {
        // Floating mode: resize from bottom-right corner, keep left/top fixed
        const newW = Math.max(280, Math.min(640, resizeStartRef.current.w + dx));
        setPanelSize({ w: newW, h: newH });
      } else {
        // Anchored mode RTL: panel fixed at left edge, handle on right → drag right = wider
        // Anchored mode LTR: panel fixed at right edge, handle on left → drag left = wider
        const newW = Math.max(280, Math.min(640, resizeStartRef.current.w + (isRtl ? dx : -dx)));
        setPanelSize({ w: newW, h: newH });
      }
    }
    function onUp() {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const msgPanelRef = useRef<HTMLDivElement>(null);
  const msgBtnRef = useRef<HTMLButtonElement>(null);

  /* ── Inline chat within message panel ── */
  const [msgPanelView, setMsgPanelView] = useState<'list' | 'chat'>('list');
  const [activeChatConv, setActiveChatConv] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatMsgsRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const chatInputRef = useRef<HTMLInputElement>(null);

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      if (chatMsgsRef.current) chatMsgsRef.current.scrollTop = 0;
    });
  }
  useEffect(() => {
    if (isAtBottomRef.current) scrollChatToBottom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages]);

  const [msgSearch, setMsgSearch] = useState('');

  /* ── Call initiated from desktop chat panel ── */
  const [desktopCall, setDesktopCall] = useState<{
    callId: string; callType: 'audio' | 'video';
    remoteUser: { id: string; name: string; avatarUrl?: string | null };
  } | null>(null);
  const [callStarting, setCallStarting] = useState(false);

  /* ── Voice message recording ── */
  const [micActive, setMicActive] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const micTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelMicRef = useRef(false);

  // Collapse on tap-outside (touchstart so it fires before blur on mobile)
  useEffect(() => {
    if (!mobileSearchOpen) return;
    function onTouch(e: TouchEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setMobileSearchOpen(false);
        if (!(searchInput ?? '').trim()) onSearch?.('');
      }
    }
    document.addEventListener('touchstart', onTouch, { passive: true });
    return () => document.removeEventListener('touchstart', onTouch);
  }, [mobileSearchOpen, searchInput, onSearch]);

  /* ── Panel animation helpers ── */
  useEffect(() => {
    if (showNotifPanel) { requestAnimationFrame(() => setNotifPanelVisible(true)); }
    else { setNotifPanelVisible(false); }
  }, [showNotifPanel]);

  useEffect(() => {
    if (showMsgPanel) { requestAnimationFrame(() => setMsgPanelVisible(true)); }
    else { setMsgPanelVisible(false); }
  }, [showMsgPanel]);

  /* ── Click-outside to close panels ── */
  useEffect(() => {
    if (!showNotifPanel && !showMsgPanel) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (showNotifPanel && notifPanelRef.current && !notifPanelRef.current.contains(t) && notifBtnRef.current && !notifBtnRef.current.contains(t)) {
        setShowNotifPanel(false);
      }
      if (showMsgPanel && msgPanelRef.current && !msgPanelRef.current.contains(t) && msgBtnRef.current && !msgBtnRef.current.contains(t)) {
        setShowMsgPanel(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showNotifPanel, showMsgPanel]);

  /* ── Load notifications ── */
  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const res = await fetch('/api/tareeq/notifications?limit=20', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setNotifs(d.notifications ?? []);
      }
    } catch { /* offline */ }
    setNotifsLoading(false);
    // Mark all read
    fetch('/api/tareeq/notifications', { method: 'POST', credentials: 'include' }).catch(() => {});
  }, []);

  /* ── Load conversations ── */
  const loadConversations = useCallback(async () => {
    setMsgsLoading(true);
    try {
      const res = await fetch('/api/tareeq/conversations', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setConversations(d.conversations ?? []);
      }
    } catch { /* offline */ }
    setMsgsLoading(false);
  }, []);

  const openChat = useCallback(async (conv: Conversation) => {
    setMsgPanelView('chat');
    setActiveChatConv(conv);
    setChatMessages([]);
    setChatLoading(true);
    const fetchMsgs = async () => {
      try {
        const res = await fetch(`/api/tareeq/conversations/${conv.id}`, { credentials: 'include' });
        if (res.ok) {
          const d = await res.json();
          const fresh = ((d.messages ?? []) as ChatMessage[]).slice().reverse();
          setChatMessages(prev => {
            if (fresh.length === 0) return prev;
            if (prev.length === 0) return fresh;
            // Only prepend genuinely new messages — prevents full re-render on every poll
            const prevIds = new Set(prev.map(m => m.id));
            const newMsgs = fresh.filter(m => !prevIds.has(m.id));
            if (newMsgs.length === 0) return prev; // no change → skip re-render & scroll jump
            if (newMsgs.length > 0) isAtBottomRef.current = true; // incoming msg → scroll to show it
            return [...prev, ...newMsgs];
          });
        }
      } catch { /* offline */ }
    };
    await fetchMsgs();
    setChatLoading(false);
    setTimeout(() => { scrollChatToBottom(); chatInputRef.current?.focus(); }, 50);
    if (chatPollingRef.current) clearInterval(chatPollingRef.current);
    chatPollingRef.current = setInterval(fetchMsgs, 3000);
  }, []);

  const closeChat = useCallback(() => {
    setMsgPanelView('list');
    setActiveChatConv(null);
    setChatMessages([]);
    setChatInput('');
    if (chatPollingRef.current) { clearInterval(chatPollingRef.current); chatPollingRef.current = null; }
  }, []);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !activeChatConv || chatSending) return;
    setChatSending(true);
    const content = chatInput.trim();
    setChatInput('');
    try {
      const res = await fetch(`/api/tareeq/conversations/${activeChatConv.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.message) { isAtBottomRef.current = true; setChatMessages(prev => [...prev, d.message]); }
      }
    } catch { /* offline */ }
    setChatSending(false);
  }, [chatInput, activeChatConv, chatSending]);

  const startDesktopCall = async (callType: 'audio' | 'video') => {
    if (!activeChatConv || callStarting) return;
    prewireOutRingPipeline(); // sync, within gesture frame — locks loudspeaker route
    setCallStarting(true);
    try {
      const res = await fetch('/api/tareeq/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ calleeId: activeChatConv.otherUser.id, type: callType }),
      });
      const d = await res.json();
      if (res.ok && d.callId) {
        setDesktopCall({ callId: d.callId, callType, remoteUser: activeChatConv.otherUser });
      }
    } catch { /* offline */ }
    setCallStarting(false);
  };

  const startVoiceRecording = async () => {
    if (!activeChatConv || micActive || voiceUploading) return;
    cancelMicRef.current = false;
    audioChunksRef.current = [];
    const convId = activeChatConv.id;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
        : '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setMicActive(false);
        setMicSeconds(0);
        if (micTimerRef.current) { clearInterval(micTimerRef.current); micTimerRef.current = null; }
        if (cancelMicRef.current) return;
        const actualMime = mr.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        if (blob.size < 100) return;
        const ext = actualMime.includes('ogg') ? 'ogg' : (actualMime.includes('mp4') || actualMime.includes('aac')) ? 'm4a' : 'webm';
        setVoiceUploading(true);
        try {
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: actualMime });
          const form = new FormData(); form.append('file', file);
          const upRes = await fetch('/api/tareeq/upload', { method: 'POST', body: form, credentials: 'include' });
          if (!upRes.ok) { setVoiceError(isRtl ? 'فشل رفع الصوت' : 'Upload failed'); setTimeout(() => setVoiceError(''), 3000); setVoiceUploading(false); return; }
          const { url: audioUrl } = await upRes.json();
          const sendRes = await fetch(`/api/tareeq/conversations/${convId}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ content: '', audioUrl }),
          });
          if (sendRes.ok) {
            const d = await sendRes.json();
            if (d.message) { isAtBottomRef.current = true; setChatMessages(prev => [...prev, d.message]); }
          } else { setVoiceError(isRtl ? 'فشل الإرسال' : 'Send failed'); setTimeout(() => setVoiceError(''), 3000); }
        } catch { setVoiceError(isRtl ? 'خطأ في الشبكة' : 'Network error'); setTimeout(() => setVoiceError(''), 3000); }
        setVoiceUploading(false);
      };
      mr.start(250);
      setMicActive(true);
      micTimerRef.current = setInterval(() => setMicSeconds(s => s + 1), 1000);
    } catch { /* permission denied or not supported */ }
  };

  const stopVoiceRecording = (cancel = false) => {
    cancelMicRef.current = cancel;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (micTimerRef.current) { clearInterval(micTimerRef.current); micTimerRef.current = null; }
  };

  function toggleMobileNotifPanel(e: React.MouseEvent) {
    e.preventDefault();
    if (!showMobileNotifPanel) loadNotifs();
    setShowMobileNotifPanel(p => !p);
  }

  function toggleNotifPanel(e: React.MouseEvent) {
    e.preventDefault();
    if (!showNotifPanel) {
      loadNotifs();
      setShowMsgPanel(false);
    }
    setShowNotifPanel(p => !p);
  }

  function toggleMsgPanel(e: React.MouseEvent) {
    e.preventDefault();
    if (showMsgPanel) {
      closeChat();
    } else {
      loadConversations();
      setShowNotifPanel(false);
      setMsgSearch('');
    }
    setShowMsgPanel(p => !p);
  }

  /* ── Nav items config ── */
  const navItems = [
    {
      key: 'home',
      href: undefined as string | undefined,
      label: isRtl ? 'ضع علامة' : 'Leave a Mark',
      badge: 0,
      onClick: ((e: React.MouseEvent) => { e.preventDefault(); onCreateClick(); }) as ((e: React.MouseEvent) => void) | undefined,
      icon: (
        <img
          src="/Add-sign.svg"
          alt=""
          draggable={false}
          style={{
            width: 42,
            height: 42,
            animation: 'tareeq-star-breathe 2.8s ease-in-out infinite',
          }}
        />
      ),
    },
    {
      key: 'messages',
      href: '/tareeq/inbox',
      label: isRtl ? 'الرسائل' : 'Messages',
      badge: messageCount,
      onClick: toggleMsgPanel,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
    },
    {
      key: 'notifications',
      href: '/tareeq/notifications',
      label: isRtl ? 'الإشعارات' : 'Notifications',
      badge: notifCount,
      onClick: toggleNotifPanel,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      key: 'profile',
      href: user ? `/tareeq/u/${user.id}` : '/tareeq',
      label: isRtl ? 'ملفي' : 'Profile',
      badge: 0,
      onClick: undefined as ((e: React.MouseEvent) => void) | undefined,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  /* ── Panel style helpers ── */
  const panelBase: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    marginTop: 8,
    width: 340,
    borderRadius: 16,
    background: 'var(--tr-surface)',
    border: '1px solid var(--tr-border-soft)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
    overflow: 'hidden',
    zIndex: 200,
    transformOrigin: 'top center',
    transition: 'opacity 200ms ease, transform 200ms ease',
  };

  const notifPanelStyle: React.CSSProperties = {
    ...panelBase,
    transformOrigin: isRtl ? 'top left' : 'top right',
    ...(isRtl ? { left: 0 } : { right: 0 }),
    transform: notifPanelVisible ? 'scaleY(1)' : 'scaleY(0.92)',
    opacity: notifPanelVisible ? 1 : 0,
    maxHeight: 480,
    overflowY: 'auto',
  };

  // Desktop header: drops down from button (absolute, positioned by wrapper's relative)
  const msgPanelStyle: React.CSSProperties = {
    ...(panelPos
      ? { position: 'fixed' as const, left: panelPos.x, top: panelPos.y }
      : { position: 'absolute' as const, top: 'calc(100% + 8px)', insetInlineEnd: 0 }
    ),
    width: panelSize.w,
    borderRadius: 16,
    background: 'var(--tr-surface)',
    border: '1px solid var(--tr-border-soft)',
    boxShadow: panelPos
      ? '0 16px 48px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.14), 0 0 0 1px rgba(255,255,255,0.04)'
      : '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)',
    overflow: 'hidden',
    zIndex: panelPos ? 9999 : 200,
    transform: msgPanelVisible ? 'translateY(0)' : 'translateY(10px)',
    opacity: msgPanelVisible ? 1 : 0,
    maxHeight: `min(${panelSize.h}px, calc(100dvh - 100px))`,
    transition: (resizingRef.current || panelDraggingRef.current) ? 'none' : 'opacity 180ms ease, transform 180ms ease',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <>
      <style>{`
        @keyframes tareeq-star-breathe {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 4px rgba(248,167,59,0.50)); }
          50%       { transform: scale(1.14); filter: drop-shadow(0 0 11px rgba(248,152,72,0.85)); }
        }
      `}</style>
      {/* Mobile notification overlay — glass strips floating above content */}
      {showMobileNotifPanel && (
        <div
          className="lg:hidden fixed inset-0 z-[110]"
          onClick={() => setShowMobileNotifPanel(false)}
        >
          <div
            className="absolute left-3 right-3 flex flex-col gap-2"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 62px)' }}
            onClick={e => e.stopPropagation()}
          >
            {notifsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--tr-gold)' }} />
              </div>
            ) : notifs.filter(n => n.type !== 'message').length === 0 ? (
              <div className="rounded-2xl px-5 py-6 text-center"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(24px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
                  {isRtl ? 'لا إشعارات جديدة' : 'No new notifications'}
                </p>
              </div>
            ) : (
              notifs.filter(n => n.type !== 'message').slice(0, 10).map(n => (
                <button
                  key={n.id}
                  className="w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl text-start transition-all active:scale-[0.98]"
                  style={{
                    background: n.read ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.13)',
                    backdropFilter: 'blur(24px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                    border: `1px solid ${n.read ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.22)'}`,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  }}
                  onClick={() => {
                    setShowMobileNotifPanel(false);
                    if (n.postId) router.push(`/tareeq/${n.postId}`);
                    else router.push('/tareeq/notifications');
                  }}
                >
                  <NotifIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.90)' }}>
                      {n.type === 'like' && (
                        <>{isRtl ? `${n.actorName || 'شخص ما'} أعجب بعلامتك` : `${n.actorName || 'Someone'} liked your mark`}
                          {n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}</>
                      )}
                      {n.type === 'comment' && (
                        <>{isRtl ? `${n.actorName || 'شخص ما'} علّق على` : `${n.actorName || 'Someone'} commented on`}
                          {n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}
                          {n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>
                      )}
                      {n.type !== 'like' && n.type !== 'comment' && (
                        <>{isRtl ? `رسالة من ${n.actorName || 'شخص ما'}` : `Message from ${n.actorName || 'Someone'}`}
                          {n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>
                      )}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {timeAgo(n.createdAt, isRtl)}
                    </p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: 'var(--tr-gold)' }} />}
                </button>
              ))
            )}
            {/* Close hint */}
            <button
              onClick={() => setShowMobileNotifPanel(false)}
              className="text-center py-2 text-xs font-semibold"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              {isRtl ? 'اضغط للإغلاق' : 'Tap to close'}
            </button>
          </div>
        </div>
      )}

      <header
        className="fixed top-0 left-0 right-0 z-50 print:hidden"
      >
        {/* Desktop glass background — invisible on mobile so content extends under floating buttons */}
        <div className="hidden lg:block absolute inset-0" style={{
          background: 'var(--tr-header-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--tr-border-subtle)',
          boxShadow: '0 2px 24px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.04)',
        }} />
        <div className="relative max-w-2xl mx-auto lg:max-w-[1180px] flex items-center px-4 h-14 lg:h-16 gap-2 lg:gap-3">

          {/* ── MOBILE ONLY: glass search pill + glass bell button ── */}
          <div className="lg:hidden flex items-center w-full gap-2.5">

            {/* Glass search pill — flex-1 */}
            <div
              ref={searchContainerRef}
              className="flex-1 relative"
              style={{ height: 44 }}
            >
              {/* Glass background */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 22,
                background: mobileSearchOpen ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.28)',
                backdropFilter: 'blur(14px) saturate(130%)',
                WebkitBackdropFilter: 'blur(14px) saturate(130%)',
                border: `1px solid ${mobileSearchOpen ? 'rgba(100,140,210,0.28)' : 'rgba(255,255,255,0.28)'}`,
                boxShadow: mobileSearchOpen ? '0 4px 20px rgba(30,70,120,0.12)' : '0 2px 10px rgba(0,0,0,0.07)',
                transition: 'background 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
                pointerEvents: 'none',
              }} />

              {/* Search icon — anchored to visual right (right in LTR, left in RTL) */}
              <button
                onClick={() => { if (!mobileSearchOpen) { setMobileSearchOpen(true); setTimeout(() => mobileSearchRef.current?.focus(), 50); } }}
                aria-label={isRtl ? 'بحث' : 'Search'}
                style={{
                  position: 'absolute',
                  [isRtl ? 'left' : 'right']: 0, top: 0,
                  width: 44, height: 44,
                  background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 2,
                  color: mobileSearchOpen ? 'rgba(30,80,180,0.85)' : 'rgba(20,30,60,0.62)',
                  transition: 'color 200ms',
                }}
              >
                <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>

              {/* Placeholder label when closed */}
              {!mobileSearchOpen && (
                <span style={{
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                  [isRtl ? 'right' : 'left']: 48,
                  fontSize: 13, color: 'rgba(20,30,60,0.40)',
                  pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: 'calc(100% - 60px)',
                }}>
                  {isRtl ? 'ابحث في طريق...' : 'Search Tareeq...'}
                </span>
              )}

              {/* Input */}
              <input
                ref={mobileSearchRef}
                value={searchInput ?? ''}
                onChange={e => onSearch?.(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setMobileSearchOpen(false); onSearch?.(''); } }}
                onBlur={() => { if (!(searchInput ?? '').trim()) setTimeout(() => setMobileSearchOpen(false), 120); }}
                placeholder={isRtl ? 'ابحث في طريق...' : 'Search Tareeq...'}
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 22, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: 'rgba(10,15,30,0.90)',
                  paddingRight: isRtl ? 48 : ((searchInput ?? '').length > 0 && mobileSearchOpen ? 34 : 14),
                  paddingLeft: isRtl ? ((searchInput ?? '').length > 0 && mobileSearchOpen ? 34 : 14) : 48,
                  opacity: mobileSearchOpen ? 1 : 0,
                  transition: 'opacity 180ms ease',
                  pointerEvents: mobileSearchOpen ? 'auto' : 'none',
                }}
              />

              {/* Clear × */}
              {mobileSearchOpen && (searchInput ?? '').length > 0 && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSearch?.(''); mobileSearchRef.current?.focus(); }}
                  style={{
                    position: 'absolute',
                    [isRtl ? 'right' : 'left']: 8, top: '50%', transform: 'translateY(-50%)',
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.10)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 2, color: 'rgba(10,15,30,0.55)',
                    fontSize: 11, fontWeight: 700,
                  }}
                >✕</button>
              )}
            </div>

            {/* Glass notification bell button — opens inline panel */}
            <button
              onClick={toggleMobileNotifPanel}
              className="relative shrink-0 flex items-center justify-center rounded-2xl transition-all active:scale-[0.93]"
              style={{
                width: 44, height: 44,
                background: showMobileNotifPanel ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.22)',
                backdropFilter: 'blur(14px) saturate(130%)',
                WebkitBackdropFilter: 'blur(14px) saturate(130%)',
                border: `1px solid ${showMobileNotifPanel ? 'rgba(212,168,83,0.45)' : 'rgba(255,255,255,0.28)'}`,
                boxShadow: showMobileNotifPanel ? '0 2px 12px rgba(212,168,83,0.22)' : '0 2px 10px rgba(0,0,0,0.07)',
              }}
              aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
            >
              <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24"
                style={{ color: (notifCount > 0 || showMobileNotifPanel) ? 'var(--tr-gold)' : 'rgba(20,30,60,0.70)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#f43f5e', color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
          </div>

          {/* ── DESKTOP ONLY ── */}
          {/* Wordmark */}
          <Link href="/tareeq" className="hidden lg:flex items-center shrink-0" aria-label="Tareeq">
            <img src="/Tareek-logo%20desktop.png" alt="طريق" className="h-10 w-auto object-contain shrink-0" draggable={false} />
          </Link>

          {/* Desktop search bar */}
          {onSearch !== undefined && (
            <div className="hidden lg:block w-56 shrink-0">
              <div className="relative">
                <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  value={searchInput ?? ''}
                  onChange={e => onSearch(e.target.value)}
                  placeholder={isRtl ? 'بحث...' : 'Search...'}
                  className="w-full rounded-full ps-8 pe-4 py-2 text-xs focus:outline-none transition"
                  style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                />
              </div>
            </div>
          )}

          {/* Desktop center nav — Facebook-style icon tabs */}
          <div className="hidden lg:flex flex-1 items-center justify-center gap-1">
            {navItems.map(({ key, href, icon, label, badge, onClick }) => {
              if (key === 'messages' || key === 'notifications' || key === 'profile') return null;
              const active = href ? (pathname === href || (href !== '/tareeq' && pathname.startsWith(href))) : false;
              const isPanelOpen = false;
              const isButton = !href || !!onClick;

              const sharedBtnStyle = {
                color: active ? 'var(--tr-gold)' : 'var(--tr-text-secondary)',
                background: 'transparent',
                gap: 2,
              };
              const dotStyle = {
                width: 4, height: 4, borderRadius: '50%' as const,
                background: active ? 'var(--tr-gold)' : 'transparent',
                transition: 'background 0.2s',
                flexShrink: 0,
              };
              const badgeEl = badge > 0 ? (
                <span className="absolute top-1.5 end-3 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-black px-0.5" style={{ background: '#f43f5e', color: '#fff' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null;

              return (
                <div key={key} className="relative">
                  {isButton ? (
                    <button
                      onClick={onClick}
                      title={label}
                      className="group relative flex flex-col items-center justify-center w-24 h-12 rounded-xl transition-all hover:bg-[var(--tr-overlay)]"
                      style={{ ...sharedBtnStyle, cursor: 'pointer' }}
                    >
                      {icon}
                      <span style={dotStyle} />
                      {badgeEl}
                      {key === 'home' && (
                        <span
                          className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                          style={{ background: 'var(--tr-raised)', color: 'var(--tr-gold)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}
                        >
                          {isRtl ? 'ضع علامة' : 'Leave a Mark'}
                        </span>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={href!}
                      title={label}
                      className="relative flex flex-col items-center justify-center w-24 h-12 rounded-xl transition-all hover:bg-[var(--tr-overlay)] group"
                      style={sharedBtnStyle}
                    >
                      {icon}
                      <span style={dotStyle} />
                      {badgeEl}
                    </Link>
                  )}

                  {/* Notifications dropdown panel */}
                  {key === 'notifications' && showNotifPanel && (
                    <div ref={notifPanelRef} style={notifPanelStyle}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                        <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>
                          {isRtl ? 'الإشعارات' : 'Notifications'}
                        </span>
                        <Link
                          href="/tareeq/notifications"
                          onClick={() => setShowNotifPanel(false)}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--tr-gold)' }}
                        >
                          {isRtl ? 'عرض الكل' : 'See all'}
                        </Link>
                      </div>

                      {notifsLoading ? (
                        <div className="flex justify-center py-10">
                          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                        </div>
                      ) : notifs.filter(n => n.type !== 'message').length === 0 ? (
                        <div className="text-center py-10 px-4">
                          <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                          </svg>
                          <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
                            {isRtl ? 'لا إشعارات جديدة' : 'No new notifications'}
                          </p>
                        </div>
                      ) : (
                        (() => {
                          const allNotifs = notifs.filter(n => n.type !== 'message');
                          const newNotifs = allNotifs.filter(n => !n.read);
                          const earlierNotifs = allNotifs.filter(n => n.read);
                          const renderNotif = (n: Notification) => (
                            <button key={n.id} onClick={() => { setShowNotifPanel(false); if (n.postId) router.push(`/tareeq/${n.postId}`); }}
                              className="w-full flex items-start gap-3 px-4 py-3 text-start transition"
                              style={{ background: n.read ? 'transparent' : 'rgba(212,168,83,0.04)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                              <NotifIcon type={n.type} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--tr-text-primary)' }}>
                                  {n.type === 'like' && <>{isRtl ? `${n.actorName || 'شخص ما'} أعجب بعلامتك` : `${n.actorName || 'Someone'} liked your mark`}{n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}</>}
                                  {n.type === 'comment' && <>{isRtl ? `${n.actorName || 'شخص ما'} علّق على` : `${n.actorName || 'Someone'} commented on`}{n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}{n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>}
                                  {n.type !== 'like' && n.type !== 'comment' && <>{isRtl ? `رسالة من ${n.actorName || 'شخص ما'}` : `Message from ${n.actorName || 'Someone'}`}{n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>}
                                </p>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(n.createdAt, isRtl)}</p>
                              </div>
                              {!n.read && <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: 'var(--tr-gold)' }} />}
                            </button>
                          );
                          return (
                            <div>
                              {newNotifs.length > 0 && (
                                <>
                                  <p className="px-4 py-2 text-[10px] font-black" style={{ color: 'var(--tr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--tr-base)' }}>{isRtl ? 'جديد' : 'New'}</p>
                                  {newNotifs.map(renderNotif)}
                                </>
                              )}
                              {earlierNotifs.length > 0 && (
                                <>
                                  <p className="px-4 py-2 text-[10px] font-black" style={{ color: 'var(--tr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--tr-base)' }}>{isRtl ? 'سابق' : 'Earlier'}</p>
                                  {earlierNotifs.map(renderNotif)}
                                </>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* Messages popup panel */}
                  {key === 'messages' && showMsgPanel && (
                    <div ref={msgPanelRef} style={msgPanelStyle}>
                      {/* Header */}
                      {msgPanelView === 'list' ? (
                        <div onMouseDown={startPanelDrag} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)', cursor: 'grab', userSelect: 'none' }}>
                          <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'الرسائل' : 'Messages'}</span>
                          <Link href="/tareeq/inbox" onClick={() => setShowMsgPanel(false)} className="text-xs font-semibold" style={{ color: 'var(--tr-gold)' }}>
                            {isRtl ? 'عرض الكل' : 'See all'}
                          </Link>
                        </div>
                      ) : (
                        <div onMouseDown={startPanelDrag} className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--tr-border-subtle)', cursor: 'grab', userSelect: 'none' }}>
                          {/* عرض الكل — يسار */}
                          <Link href={`/tareeq/inbox/${activeChatConv?.id}`} onClick={() => setShowMsgPanel(false)} className="flex items-center gap-1 px-2 h-7 rounded-full shrink-0 transition hover:bg-[var(--tr-overlay)]" style={{ color: 'var(--tr-gold)', fontSize: 11, fontWeight: 700 }}>
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                            {isRtl ? 'عرض الكل' : 'See all'}
                          </Link>
                          {/* اسم المحادثة — وسط */}
                          <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
                            {activeChatConv?.otherUser.avatarUrl ? (
                              <img src={activeChatConv.otherUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)' }}>
                                {activeChatConv?.otherUser.name.charAt(0)}
                              </div>
                            )}
                            <span className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{activeChatConv?.otherUser.name}</span>
                          </div>
                          {/* سهم الباك — يمين */}
                          <button onClick={closeChat} className="w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 hover:bg-[var(--tr-overlay)]" style={{ color: 'var(--tr-text-secondary)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Content */}
                      {msgPanelView === 'list' ? (
                        <>
                          {/* Search */}
                          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                            <div className="relative">
                              <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                              </svg>
                              <input
                                value={msgSearch}
                                onChange={e => setMsgSearch(e.target.value)}
                                placeholder={isRtl ? 'بحث في الرسائل...' : 'Search messages...'}
                                className="w-full rounded-full ps-8 pe-3 py-1.5 text-xs focus:outline-none"
                                style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                              />
                            </div>
                          </div>
                          {msgsLoading ? (
                            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} /></div>
                          ) : conversations.filter(c => !msgSearch || c.otherUser.name.toLowerCase().includes(msgSearch.toLowerCase())).length === 0 ? (
                            <div className="text-center py-10 px-4">
                              <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا رسائل بعد' : 'No messages yet'}</p>
                              <p className="text-xs mt-1.5" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'ابدأ محادثة من صفحة أي مستخدم' : 'Start a chat from any profile'}</p>
                            </div>
                          ) : (
                            <div>
                              {conversations.filter(c => !msgSearch || c.otherUser.name.toLowerCase().includes(msgSearch.toLowerCase())).map(c => (
                                <button key={c.id} onClick={() => openChat(c)} className="w-full flex items-center gap-3 px-4 py-3 text-start transition" style={{ background: c.unreadCount > 0 ? 'rgba(212,168,83,0.04)' : 'transparent', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden relative" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                                    {c.otherUser.avatarUrl ? <img src={c.otherUser.avatarUrl} alt={c.otherUser.name} className="w-full h-full object-cover" /> : c.otherUser.name.charAt(0)}
                                    {c.unreadCount > 0 && <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full border-2" style={{ background: 'var(--tr-gold)', borderColor: 'var(--tr-surface)' }} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{c.otherUser.name}</p>
                                    {c.lastMessage && <p className="text-xs truncate mt-0.5" style={{ color: c.unreadCount > 0 ? 'var(--tr-text-primary)' : 'var(--tr-text-muted)', fontWeight: c.unreadCount > 0 ? 600 : 400 }}>{c.lastMessage}</p>}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {c.lastMessageAt && <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(c.lastMessageAt, isRtl)}</span>}
                                    {c.unreadCount > 0 && <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>{c.unreadCount}</span>}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Chat view */
                        <>
                          <div ref={chatMsgsRef} onScroll={e => { isAtBottomRef.current = e.currentTarget.scrollTop <= 5; }} className="overflow-y-auto flex flex-col-reverse gap-1 p-3" style={{ flex: 1, minHeight: 0 }}>
                            {chatLoading ? (
                              <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} /></div>
                            ) : chatMessages.length === 0 ? (
                              <p className="text-center text-xs py-6" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'ابدأ المحادثة...' : 'Start the conversation...'}</p>
                            ) : (
                              [...chatMessages].reverse().map(msg => {
                                const isMine = msg.senderId === user?.id;
                                return (
                                  <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                                    <div className="max-w-[80%] px-3 py-2 text-xs leading-relaxed" style={{
                                      background: isMine ? 'var(--tr-gold)' : 'var(--tr-overlay)',
                                      color: isMine ? '#fff' : 'var(--tr-text-primary)',
                                      borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    }}>
                                      {msg.content}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          {/* Input */}
                          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
                            <input
                              ref={chatInputRef}
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                              placeholder={isRtl ? 'اكتب رسالة...' : 'Type a message...'}
                              disabled={chatSending}
                              className="flex-1 rounded-full px-3 py-2 text-xs focus:outline-none"
                              style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                            />
                            <button
                              onClick={sendChatMessage}
                              disabled={!chatInput.trim() || chatSending}
                              className="w-8 h-8 rounded-full flex items-center justify-center transition shrink-0"
                              style={{ background: chatInput.trim() ? 'var(--tr-gold)' : 'var(--tr-overlay)', color: chatInput.trim() ? '#fff' : 'var(--tr-text-muted)' }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                      {/* Resize handle — bottom-start corner */}
                      <div
                        onMouseDown={startPanelResize}
                        style={{ position: 'absolute', bottom: 0, insetInlineStart: 0, width: 20, height: 20, cursor: isRtl ? 'nesw-resize' : 'nwse-resize', zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 4, opacity: 0.35 }}
                      >
                        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tr-text-muted)' }}>
                          <path d="M1 9L9 1M5 9L9 5M1 5L5 1" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: messages icon, notifications icon, notebook, create button, avatar */}
          <div className="hidden lg:flex items-center gap-1 shrink-0">

            {/* Messages icon + panel */}
            {user && (
              <div className="relative">
                <button ref={msgBtnRef} onClick={toggleMsgPanel} title={isRtl ? 'الرسائل' : 'Messages'}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full transition-all hover:bg-[var(--tr-overlay)]"
                  style={{ color: showMsgPanel ? 'var(--tr-gold)' : 'var(--tr-text-secondary)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  <Badge count={messageCount} />
                </button>
                {showMsgPanel && (
                  <div ref={msgPanelRef} style={msgPanelStyle} dir={isRtl ? 'rtl' : 'ltr'}>
                    {msgPanelView === 'list' ? (
                      <div onMouseDown={startPanelDrag} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)', cursor: 'grab', userSelect: 'none' }}>
                        <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'الرسائل' : 'Messages'}</span>
                        <Link href="/tareeq/inbox" onClick={() => setShowMsgPanel(false)} className="text-xs font-semibold" style={{ color: 'var(--tr-gold)' }}>{isRtl ? 'عرض الكل' : 'See all'}</Link>
                      </div>
                    ) : (
                      <div onMouseDown={startPanelDrag} className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--tr-border-subtle)', cursor: 'grab', userSelect: 'none' }}>
                        {/* عرض الكل — يسار */}
                        <Link href={`/tareeq/inbox/${activeChatConv?.id}`} onClick={() => setShowMsgPanel(false)} className="flex items-center gap-1 px-2 h-7 rounded-full shrink-0 transition hover:bg-[var(--tr-overlay)]" style={{ color: 'var(--tr-gold)', fontSize: 11, fontWeight: 700 }}>
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                          {isRtl ? 'عرض الكل' : 'See all'}
                        </Link>
                        {/* اسم المحادثة — وسط */}
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
                          {activeChatConv?.otherUser.avatarUrl ? (
                            <img src={activeChatConv.otherUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)' }}>{activeChatConv?.otherUser.name.charAt(0)}</div>
                          )}
                          <span className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{activeChatConv?.otherUser.name}</span>
                        </div>
                        {/* أزرار الاتصال + سهم الباك — يمين */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => startDesktopCall('audio')} disabled={callStarting}
                            title={isRtl ? 'مكالمة صوتية' : 'Audio call'}
                            className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--tr-overlay)]"
                            style={{ color: 'var(--tr-text-secondary)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                          </button>
                          <button onClick={() => startDesktopCall('video')} disabled={callStarting}
                            title={isRtl ? 'مكالمة فيديو' : 'Video call'}
                            className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--tr-overlay)]"
                            style={{ color: 'var(--tr-text-secondary)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </button>
                          <button onClick={closeChat} className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-[var(--tr-overlay)]" style={{ color: 'var(--tr-text-secondary)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                    {msgPanelView === 'list' ? (
                      <>
                        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                          <div className="relative">
                            <svg className="absolute top-1/2 -translate-y-1/2 start-3 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                            <input value={msgSearch} onChange={e => setMsgSearch(e.target.value)} placeholder={isRtl ? 'بحث في الرسائل...' : 'Search messages...'}
                              className="w-full rounded-full ps-8 pe-3 py-1.5 text-xs focus:outline-none"
                              style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }} />
                          </div>
                        </div>
                        {msgsLoading ? (
                          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} /></div>
                        ) : conversations.filter(c => !msgSearch || c.otherUser.name.toLowerCase().includes(msgSearch.toLowerCase())).length === 0 ? (
                          <div className="text-center py-10 px-4">
                            <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا رسائل بعد' : 'No messages yet'}</p>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'ابدأ محادثة من صفحة أي مستخدم' : 'Start a chat from any profile'}</p>
                          </div>
                        ) : (
                          <div>
                            {conversations.filter(c => !msgSearch || c.otherUser.name.toLowerCase().includes(msgSearch.toLowerCase())).map(c => (
                              <button key={c.id} onClick={() => openChat(c)} className="w-full flex items-center gap-3 px-4 py-3 text-start transition" style={{ background: c.unreadCount > 0 ? 'rgba(212,168,83,0.04)' : 'transparent', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden relative" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                                  {c.otherUser.avatarUrl ? <img src={c.otherUser.avatarUrl} alt={c.otherUser.name} className="w-full h-full object-cover" /> : c.otherUser.name.charAt(0)}
                                  {c.unreadCount > 0 && <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full border-2" style={{ background: 'var(--tr-gold)', borderColor: 'var(--tr-surface)' }} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{c.otherUser.name}</p>
                                  {c.lastMessage && <p className="text-xs truncate mt-0.5" style={{ color: c.unreadCount > 0 ? 'var(--tr-text-primary)' : 'var(--tr-text-muted)', fontWeight: c.unreadCount > 0 ? 600 : 400 }}>{c.lastMessage}</p>}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {c.lastMessageAt && <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(c.lastMessageAt, isRtl)}</span>}
                                  {c.unreadCount > 0 && <span className="text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--tr-gold)', color: '#0a0d06' }}>{c.unreadCount}</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div ref={chatMsgsRef} onScroll={e => { isAtBottomRef.current = e.currentTarget.scrollTop <= 5; }} className="overflow-y-auto flex flex-col-reverse gap-1 p-3" style={{ flex: 1, minHeight: 0 }}>
                          {chatLoading ? (
                            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} /></div>
                          ) : chatMessages.length === 0 ? (
                            <p className="text-center text-xs py-6" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'ابدأ المحادثة...' : 'Start the conversation...'}</p>
                          ) : (
                            [...chatMessages].reverse().map(msg => {
                              const isMine = msg.senderId === user?.id;
                              return (
                                <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                                  <div className="max-w-[80%] px-3 py-2 text-xs leading-relaxed" style={{ background: isMine ? 'var(--tr-gold)' : 'var(--tr-overlay)', color: isMine ? '#fff' : 'var(--tr-text-primary)', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px' }}>
                                    {msg.content}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        {voiceError && (
                          <div className="px-3 pb-1">
                            <p className="text-[10px] text-red-500 text-center">{voiceError}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
                          {micActive ? (
                            /* Recording UI */
                            <div className="flex-1 flex items-center gap-2">
                              <div className="flex items-center gap-1.5 flex-1 rounded-full px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                                <span style={{ color: 'var(--tr-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                  {`${Math.floor(micSeconds / 60)}:${String(micSeconds % 60).padStart(2, '0')}`}
                                </span>
                              </div>
                              {/* Cancel */}
                              <button onClick={() => stopVoiceRecording(true)} title={isRtl ? 'إلغاء' : 'Cancel'}
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                              {/* Send */}
                              <button onClick={() => stopVoiceRecording(false)} title={isRtl ? 'إرسال' : 'Send'}
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: 'var(--tr-gold)', color: '#fff' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                              </button>
                            </div>
                          ) : voiceUploading ? (
                            <div className="flex-1 flex items-center justify-center gap-2 py-1">
                              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                              <span className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'جاري الإرسال...' : 'Sending...'}</span>
                            </div>
                          ) : (
                            <>
                              {/* Mic button */}
                              <button onClick={startVoiceRecording} title={isRtl ? 'رسالة صوتية' : 'Voice message'}
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition"
                                style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                </svg>
                              </button>
                              {/* Text input */}
                              <input ref={chatInputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                                placeholder={isRtl ? 'اكتب رسالة...' : 'Type a message...'} disabled={chatSending}
                                className="flex-1 rounded-full px-3 py-2 text-xs focus:outline-none"
                                style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }} />
                              {/* Send button */}
                              <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition shrink-0"
                                style={{ background: chatInput.trim() ? 'var(--tr-gold)' : 'var(--tr-overlay)', color: chatInput.trim() ? '#fff' : 'var(--tr-text-muted)' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                    {/* Resize handle — bottom-start corner */}
                    <div
                      onMouseDown={startPanelResize}
                      style={{ position: 'absolute', bottom: 0, insetInlineStart: 0, width: 20, height: 20, cursor: isRtl ? 'nesw-resize' : 'nwse-resize', zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 4, opacity: 0.35 }}
                    >
                      <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--tr-text-muted)' }}>
                        <path d="M1 9L9 1M5 9L9 5M1 5L5 1" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notifications icon + panel */}
            {user && (
              <div className="relative">
                <button ref={notifBtnRef} onClick={toggleNotifPanel} title={isRtl ? 'الإشعارات' : 'Notifications'}
                  className="relative flex items-center justify-center w-10 h-10 rounded-full transition-all hover:bg-[var(--tr-overlay)]"
                  style={{ color: showNotifPanel ? 'var(--tr-gold)' : 'var(--tr-text-secondary)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <Badge count={notifCount} />
                </button>
                {showNotifPanel && (
                  <div ref={notifPanelRef} style={notifPanelStyle} dir="rtl">
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
                      <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'الإشعارات' : 'Notifications'}</span>
                      <Link href="/tareeq/notifications" onClick={() => setShowNotifPanel(false)} className="text-xs font-semibold" style={{ color: 'var(--tr-gold)' }}>{isRtl ? 'عرض الكل' : 'See all'}</Link>
                    </div>
                    {notifsLoading ? (
                      <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} /></div>
                    ) : notifs.filter(n => n.type !== 'message').length === 0 ? (
                      <div className="text-center py-10 px-4">
                        <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                        <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا إشعارات جديدة' : 'No new notifications'}</p>
                      </div>
                    ) : (
                      (() => {
                        const allNotifs = notifs.filter(n => n.type !== 'message');
                        const newNotifs = allNotifs.filter(n => !n.read);
                        const earlierNotifs = allNotifs.filter(n => n.read);
                        const renderNotif = (n: Notification) => (
                          <button key={n.id} onClick={() => { setShowNotifPanel(false); if (n.postId) router.push(`/tareeq/${n.postId}`); }}
                            className="w-full flex items-start gap-3 px-4 py-3 text-start transition"
                            style={{ background: n.read ? 'transparent' : 'rgba(212,168,83,0.04)', borderBottom: '1px solid var(--tr-border-subtle)' }}>
                            <NotifIcon type={n.type} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--tr-text-primary)' }}>
                                {n.type === 'like' && <>{isRtl ? `${n.actorName || 'شخص ما'} أعجب بعلامتك` : `${n.actorName || 'Someone'} liked your mark`}{n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}</>}
                                {n.type === 'comment' && <>{isRtl ? `${n.actorName || 'شخص ما'} علّق على` : `${n.actorName || 'Someone'} commented on`}{n.postTitle && <span className="font-semibold"> «{n.postTitle}»</span>}{n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>}
                                {n.type !== 'like' && n.type !== 'comment' && <>{isRtl ? `رسالة من ${n.actorName || 'شخص ما'}` : `Message from ${n.actorName || 'Someone'}`}{n.body && <span className="block opacity-60 truncate mt-0.5">{n.body}</span>}</>}
                              </p>
                              <p className="text-[10px] mt-1" style={{ color: 'var(--tr-text-muted)' }}>{timeAgo(n.createdAt, isRtl)}</p>
                            </div>
                            {!n.read && <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: 'var(--tr-gold)' }} />}
                          </button>
                        );
                        return (
                          <div>
                            {newNotifs.length > 0 && (<>
                              <p className="px-4 py-2 text-[10px] font-black" style={{ color: 'var(--tr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--tr-base)' }}>{isRtl ? 'جديد' : 'New'}</p>
                              {newNotifs.map(renderNotif)}
                            </>)}
                            {earlierNotifs.length > 0 && (<>
                              <p className="px-4 py-2 text-[10px] font-black" style={{ color: 'var(--tr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--tr-base)' }}>{isRtl ? 'سابق' : 'Earlier'}</p>
                              {earlierNotifs.map(renderNotif)}
                            </>)}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Create button + avatar */}
            {user && (
              <div className="flex items-center gap-2 ms-1">
                <button
                  onClick={onCreateClick}
                  className="flex items-center gap-1.5 font-black text-xs px-4 py-2 rounded-full transition active:scale-95"
                  style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#fff', boxShadow: '0 2px 10px var(--tr-gold-glow)' }}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {isRtl ? 'اترك علامة' : 'Leave a Mark'}
                </button>
                <Link href={`/tareeq/u/${user.id}`} className="shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name ?? ''} className="w-9 h-9 rounded-full object-cover" style={{ border: '2px solid var(--tr-gold-dim)' }} />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black" style={{ background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)', border: '2px solid var(--tr-gold-dim)' }}>
                      {user.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </Link>
              </div>
            )}
            {!user && (
              <Link href="/login?next=/tareeq" className="hidden lg:flex items-center gap-1.5 font-bold text-xs px-4 py-2 rounded-full transition" style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-primary)', border: '1px solid var(--tr-border-soft)' }}>
                {isRtl ? 'تسجيل الدخول' : 'Sign In'}
              </Link>
            )}
          </div>
        </div>
      </header>
      {/* No spacer on mobile — content scrolls under the transparent floating buttons */}
      <div className="hidden lg:block lg:h-16" />

      {/* Call overlay — initiated from desktop chat panel */}
      {desktopCall && (
        <TareeqCallScreen
          callId={desktopCall.callId}
          role="caller"
          callType={desktopCall.callType}
          remoteUser={desktopCall.remoteUser}
          onEnd={() => setDesktopCall(null)}
        />
      )}
    </>
  );
}
