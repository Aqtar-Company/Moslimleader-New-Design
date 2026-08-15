'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/compress-image';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import TareeqQRModal from '@/components/tareeq/TareeqQRModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProfileUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  createdAt: string;
}

interface Props {
  profileUser: ProfileUser;
  initialPosts: TareeqPostSummary[];
  initialCursor: string | null;
  likedIds: string[];
  postCount?: number;
}

interface BmFolder {
  id: string;
  name: string;
  _count: { bookmarks: number };
}

interface BmPost {
  id: string;
  post: TareeqPostSummary;
}

// ── Category colours (mirroring globals.css tokens) ─────────────────
const CAT_COLOR: Record<string, string> = {
  experience: '#f59e0b', story: '#a855f7', idea: '#3b82f6',
  question: '#22c55e', project: '#f97316', reflection: '#f43f5e',
};
function catColor(cat?: string | null) { return CAT_COLOR[cat ?? ''] ?? '#6366f1'; }

// ── Compact grid card (2-column grid inside bookmarks) ────────────────
function BmGridCard({ bm }: { bm: BmPost }) {
  const router = useRouter();
  const post = bm.post;
  const firstWords = (post.title || post.content).replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
  const col = catColor(post.category);
  return (
    <button
      onClick={() => router.push(`/tareeq/${post.id}`)}
      className="w-full text-start rounded-2xl overflow-hidden active:scale-95 transition-transform"
      style={{ border: '1px solid var(--tr-border-subtle)', aspectRatio: '3/4', position: 'relative', display: 'block' }}
    >
      {post.imageUrl
        ? <img src={post.imageUrl} alt="" className="w-full h-full object-cover absolute inset-0" />
        : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${col}cc, ${col}66)` }} />
      }
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 40%, transparent 70%)' }} />
      <p
        className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 text-[11px] font-bold leading-snug line-clamp-2"
        style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
      >
        {firstWords}
      </p>
    </button>
  );
}

// ── Compact list row (single-column list inside bookmarks) ────────────
function BmListCard({ bm }: { bm: BmPost }) {
  const router = useRouter();
  const post = bm.post;
  const firstLine = (post.title || post.content).replace(/\s+/g, ' ').trim().slice(0, 70);
  const col = catColor(post.category);
  const ago = (() => {
    const diff = Math.floor((Date.now() - new Date(post.createdAt).getTime()) / 86400000);
    if (diff === 0) return 'اليوم';
    if (diff === 1) return 'أمس';
    return `${diff}د`;
  })();
  return (
    <button
      onClick={() => router.push(`/tareeq/${post.id}`)}
      className="w-full text-start flex items-center gap-3 p-3 rounded-2xl transition active:scale-[0.98]"
      style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-raised)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-surface)'; }}
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative" style={{ background: `linear-gradient(135deg, ${col}cc, ${col}44)` }}>
        {post.imageUrl && <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--tr-text-primary)' }}>{firstLine}</p>
        <div className="flex items-center gap-2 mt-1">
          {post.category && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${col}22`, color: col }}>
              {post.category}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{ago}</span>
        </div>
      </div>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function nameGradient(name: string): string {
  const palettes = [
    ['#ff7857', '#ff3d1a'],
    ['#f59e0b', '#d97706'],
    ['#0d9488', '#0f766e'],
    ['#6366f1', '#4338ca'],
    ['#ec4899', '#be185d'],
    ['#14b8a6', '#0f766e'],
  ];
  let code = 0;
  for (let i = 0; i < name.length; i++) code += name.charCodeAt(i);
  const pair = palettes[code % palettes.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

type ProfileTab = 'posts' | 'bookmarks';

export default function TareeqUserClient({ profileUser, initialPosts, initialCursor, likedIds: initialLiked, postCount }: Props) {
  const { isRtl } = useLang();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<TareeqPostSummary[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [postsHasImages] = useState(() => initialPosts.some(p => p.imageUrl));
  const [likedIds] = useState<Set<string>>(new Set(initialLiked));
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [reactedPosts, setReactedPosts] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Bookmarks state
  const [bmFolders, setBmFolders] = useState<BmFolder[]>([]);
  const [bmFoldersLoaded, setBmFoldersLoaded] = useState(false);
  const [bmFoldersLoading, setBmFoldersLoading] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFolderName, setActiveFolderName] = useState('');
  const [bmPosts, setBmPosts] = useState<BmPost[]>([]);
  const [bmPostsLoading, setBmPostsLoading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [bmViewMode, setBmViewMode] = useState<'grid' | 'list'>('grid');

  // Follow list modal
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followListUsers, setFollowListUsers] = useState<{ id: string; name: string; avatarUrl?: string | null; isFollowedByViewer: boolean }[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const isOwnProfile = user?.id === profileUser.id;

  // Avatar upload
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);

  // Cover photo upload
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null | undefined>(profileUser.coverUrl);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarProgress(0);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
    try {
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.88 });
      const form = new FormData();
      form.append('file', compressed);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/account/avatar');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setAvatarProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) { updateUser({ avatarUrl: data.avatarUrl }); setAvatarPreview(null); resolve(); }
            else reject();
          } catch { reject(); }
        };
        xhr.onerror = () => reject();
        xhr.send(form);
      });
    } catch { /* keep preview */ }
    finally { setAvatarUploading(false); e.target.value = ''; }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
    try {
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 400, quality: 0.85 });
      const form = new FormData();
      form.append('file', compressed);
      const res = await fetch('/api/account/cover', { method: 'POST', credentials: 'include', body: form });
      if (res.ok) {
        const data = await res.json();
        setCoverUrl(data.coverUrl);
        setCoverPreview(null);
      }
    } catch { /* keep preview */ }
    finally { setCoverUploading(false); e.target.value = ''; }
  }

  useEffect(() => {
    fetch(`/api/tareeq/follow/${profileUser.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setIsFollowing(d.isFollowing ?? false);
        setFollowerCount(d.followerCount ?? 0);
        setFollowingCount(d.followingCount ?? 0);
      })
      .catch(() => {});
    fetch('/api/tareeq/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.reactedPosts) setReactedPosts(d.reactedPosts); })
      .catch(() => {});
  }, [profileUser.id]);

  const loadMore = useCallback(async (cur: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: profileUser.id, cursor: cur, limit: '12' });
      const res = await fetch(`/api/tareeq?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => [...prev, ...data.posts]);
        setCursor(data.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }, [profileUser.id]);

  async function loadBmFolders() {
    if (bmFoldersLoaded || bmFoldersLoading) return;
    setBmFoldersLoading(true);
    try {
      const res = await fetch('/api/tareeq/bookmark-folders', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setBmFolders(d.folders ?? []); }
    } finally {
      setBmFoldersLoading(false);
      setBmFoldersLoaded(true);
    }
  }

  async function createFolder() {
    if (!newFolderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    try {
      const res = await fetch('/api/tareeq/bookmark-folders', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setBmFolders(prev => [...prev, { ...d.folder, _count: { bookmarks: 0 } }]);
        setNewFolderName(''); setShowCreateFolder(false);
      }
    } catch { /* ignore */ }
    finally { setCreatingFolder(false); }
  }

  async function loadBmPosts(folderId: string | null) {
    setBmPostsLoading(true);
    try {
      const url = folderId ? `/api/tareeq/bookmarks?folderId=${folderId}` : '/api/tareeq/bookmarks';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setBmPosts(d.bookmarks ?? []); }
    } finally {
      setBmPostsLoading(false);
    }
  }

  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loading) loadMore(cursor); },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loading, loadMore]);

  function handleTabChange(tab: ProfileTab) {
    setActiveTab(tab);
    if (tab === 'bookmarks' && isOwnProfile) {
      loadBmFolders();
      setActiveFolderId(null);
    }
  }

  function handleFolderOpen(folder: BmFolder) {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.name);
    loadBmPosts(folder.id);
  }

  function handleCreateClick() {
    if (!user) { setShowGate(true); return; }
    setShowCreate(true);
  }

  async function openFollowList(type: 'followers' | 'following') {
    setFollowListType(type);
    setFollowListLoading(true);
    setFollowListUsers([]);
    try {
      const res = await fetch(`/api/tareeq/follow/${profileUser.id}/list?type=${type}`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setFollowListUsers(d.users ?? []); }
    } catch { /* ignore */ }
    finally { setFollowListLoading(false); }
  }

  async function toggleFollowFromList(targetId: string, currentlyFollowing: boolean) {
    setFollowListUsers(prev => prev.map(u => u.id === targetId ? { ...u, isFollowedByViewer: !currentlyFollowing } : u));
    await fetch(`/api/tareeq/follow/${targetId}`, { method: 'POST', credentials: 'include' }).catch(() => {
      setFollowListUsers(prev => prev.map(u => u.id === targetId ? { ...u, isFollowedByViewer: currentlyFollowing } : u));
    });
  }

  async function handleSendMessage() {
    if (!user) { setShowGate(true); return; }
    try {
      const res = await fetch('/api/tareeq/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: profileUser.id }),
      });
      if (res.ok) {
        const d = await res.json();
        router.push(`/tareeq/inbox/${d.conversationId}`);
      }
    } catch { /* ignore */ }
  }

  const coverGradient = nameGradient(profileUser.name);
  const skeletons = Array.from({ length: 6 });

  const joinedLabel = (() => {
    const d = new Date(profileUser.createdAt);
    return d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' });
  })();

  // Shared avatar JSX — rendered at two sizes
  function AvatarEl({ size }: { size: number }) {
    const border = size >= 110 ? 5 : 4;
    const ring = size >= 110 ? 3 : 3;
    const camSize = size >= 110 ? 9 : 8;
    const src = avatarPreview ?? (isOwnProfile ? (user?.avatarUrl ?? profileUser.avatarUrl ?? '') : (profileUser.avatarUrl ?? ''));
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {src ? (
          <img
            src={src}
            alt={profileUser.name}
            className="rounded-full object-cover w-full h-full"
            style={{ border: `${border}px solid var(--tr-surface)`, boxShadow: `0 0 0 ${ring}px var(--tr-gold)` }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center font-black w-full h-full"
            style={{
              fontSize: size * 0.38,
              background: coverGradient, color: '#fff',
              border: `${border}px solid var(--tr-surface)`,
              boxShadow: `0 0 0 ${ring}px var(--tr-gold)`,
            }}
          >
            {profileUser.name.charAt(0)}
          </div>
        )}
        {avatarUploading && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <svg className="absolute -rotate-90" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
              <circle cx={size / 2} cy={size / 2} r={size / 2 - 5} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
              <circle cx={size / 2} cy={size / 2} r={size / 2 - 5} fill="none" stroke="#fff" strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * (size / 2 - 5)}`}
                strokeDashoffset={`${2 * Math.PI * (size / 2 - 5) * (1 - avatarProgress / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s ease' }} />
            </svg>
            <span className="text-white font-black text-xs relative z-10">{avatarProgress}%</span>
          </div>
        )}
        {isOwnProfile && !avatarUploading && (
          <label
            className={`absolute bottom-0 end-0 w-${camSize} h-${camSize} rounded-full flex items-center justify-center cursor-pointer transition active:scale-90`}
            style={{ background: 'var(--tr-gold)', border: '2px solid var(--tr-surface)', width: camSize * 4, height: camSize * 4 }}
          >
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarUpload} />
            <svg className="w-4 h-4" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </label>
        )}
      </div>
    );
  }

  // Settings button (shared)
  function SettingsBtn({ className }: { className?: string }) {
    return (
      <button
        onClick={() => window.dispatchEvent(new Event('tareeq:open-settings'))}
        className={`flex items-center gap-1.5 font-bold text-xs px-4 py-2 rounded-full transition-all active:scale-95 ${className ?? ''}`}
        style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {isRtl ? 'الإعدادات' : 'Settings'}
      </button>
    );
  }

  // ── Bookmarks content (shared between desktop and mobile) ─────────────
  const bookmarkContent = (
    <>
      {activeFolderId && (
        <button
          onClick={() => { setActiveFolderId(null); setBmPosts([]); }}
          className="flex items-center gap-2 mb-4 text-sm font-bold transition"
          style={{ color: 'var(--tr-gold)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          </svg>
          {activeFolderName || (isRtl ? 'المحفوظات' : 'Saved')}
        </button>
      )}

      {!activeFolderId && (
        bmFoldersLoading ? (
          <div className="flex flex-col gap-3">
            {skeletons.slice(0, 3).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--tr-surface)' }} />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4">
              {showCreateFolder ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowCreateFolder(false); setNewFolderName(''); } }}
                    placeholder={isRtl ? 'اسم الفولدر...' : 'Folder name...'}
                    maxLength={40}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
                  />
                  <button
                    onClick={createFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40"
                    style={{ background: 'var(--tr-gold)', color: '#fff' }}
                  >
                    {creatingFolder ? '...' : (isRtl ? 'إنشاء' : 'Create')}
                  </button>
                  <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="p-2 rounded-xl" style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl w-full transition"
                  style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1px dashed var(--tr-border-soft)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {isRtl ? 'فولدر جديد' : 'New Folder'}
                </button>
              )}
            </div>

            <button
              onClick={() => { setActiveFolderId('__all__'); setActiveFolderName(isRtl ? 'كل المحفوظات' : 'All saved'); loadBmPosts(null); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl mb-3 transition text-start"
              style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-raised)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--tr-surface)'; }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212,168,83,0.15)' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                  <path d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'كل المحفوظات' : 'All saved'}</p>
                <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'جميع العلامات المحفوظة' : 'All bookmarked marks'}</p>
              </div>
            </button>

            {bmFolders.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" />
                </svg>
                <p className="font-semibold text-sm" style={{ color: 'var(--tr-text-secondary)' }}>
                  {isRtl ? 'لا توجد تصنيفات بعد' : 'No folders yet'}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--tr-text-muted)' }}>
                  {isRtl ? 'احفظ أي علامة لتظهر هنا' : 'Save any mark to see it here'}
                </p>
              </div>
            )}

            {bmFolders.length > 0 && (
              <div className="flex flex-col gap-3">
                {bmFolders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFolderOpen(f)}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition text-start"
                    style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--tr-overlay)' }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{f.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{f._count.bookmarks} {isRtl ? 'علامة' : 'marks'}</p>
                    </div>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </>
        )
      )}

      {activeFolderId && (
        bmPostsLoading ? (
          <div className="flex flex-col gap-3">
            {skeletons.slice(0, 6).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--tr-surface)' }} />
            ))}
          </div>
        ) : bmPosts.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" />
            </svg>
            <p className="font-semibold text-sm" style={{ color: 'var(--tr-text-secondary)' }}>
              {isRtl ? 'لا توجد علامات في هذا التصنيف' : 'No marks in this folder'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end gap-1 mb-3">
              <button
                onClick={() => setBmViewMode('grid')}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition"
                style={{ background: bmViewMode === 'grid' ? 'var(--tr-gold-glow)' : 'var(--tr-overlay)', color: bmViewMode === 'grid' ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}
                aria-label="Grid view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setBmViewMode('list')}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition"
                style={{ background: bmViewMode === 'list' ? 'var(--tr-gold-glow)' : 'var(--tr-overlay)', color: bmViewMode === 'list' ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}
                aria-label="List view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {bmViewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-2">
                {bmPosts.map(bm => <BmGridCard key={bm.id} bm={bm} />)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {bmPosts.map(bm => <BmListCard key={bm.id} bm={bm} />)}
              </div>
            )}
          </>
        )
      )}
    </>
  );

  // ── Posts empty state ─────────────────────────────────────────────────
  const postsEmpty = (
    <div className="text-center py-20">
      <svg className="w-14 h-14 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
      <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>{isRtl ? 'لا توجد علامات بعد' : 'No marks yet'}</p>
      {isOwnProfile && (
        <button onClick={handleCreateClick} className="mt-5 font-black px-8 py-3 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))', color: '#fff' }}>
          {isRtl ? '★ اترك علامتك' : '★ Leave Your Mark'}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--tr-base)' }}>

      {/* ════════════════════════════════════════════════════════════
          DESKTOP LAYOUT
      ════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col min-h-screen">
        <TareeqHeader onCreateClick={handleCreateClick} />
        {/* Header spacer */}
        <div style={{ height: 64 }} />

        <div className="flex-1">
          <div className="max-w-[1100px] mx-auto px-6 py-6">

            {/* ── Cover ── */}
            <div
              className="relative rounded-2xl overflow-hidden group"
              style={{ height: 240, background: coverGradient }}
            >
              {/* Cover image or gradient */}
              {(coverPreview ?? coverUrl) ? (
                <img
                  src={coverPreview ?? coverUrl!}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.18)' }} />
                  <div className="absolute rounded-full opacity-20" style={{ width: 280, height: 280, bottom: -80, insetInlineEnd: -40, background: 'rgba(255,255,255,0.25)' }} />
                  <div className="absolute rounded-full opacity-15" style={{ width: 180, height: 180, top: -50, insetInlineStart: '30%', background: 'rgba(255,255,255,0.3)' }} />
                  <div className="absolute rounded-full opacity-10" style={{ width: 100, height: 100, top: 20, insetInlineStart: '60%', background: 'rgba(255,255,255,0.4)' }} />
                  <div className="absolute" style={{ bottom: 20, insetInlineStart: 24, fontSize: 28, opacity: 0.6 }}>★</div>
                </>
              )}
              {/* Cover upload button — own profile only */}
              {isOwnProfile && (
                <label
                  className="absolute bottom-3 end-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                  style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 600 }}
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleCoverUpload} />
                  {coverUploading ? (
                    <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  )}
                  {coverUploading ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'تغيير الغلاف' : 'Change cover')}
                </label>
              )}
            </div>

            {/* ── Avatar + identity row ── */}
            <div className="flex items-end gap-5" style={{ marginTop: -56, position: 'relative', zIndex: 1 }}>
              <AvatarEl size={120} />

              {/* Identity section */}
              <div className="flex-1 min-w-0 pb-2 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-black text-2xl leading-tight truncate" style={{ color: 'var(--tr-text-primary)', textShadow: '0 1px 8px rgba(0,0,0,0.18)' }}>
                    {profileUser.name}
                  </h1>
                  <div className="flex gap-6 mt-2">
                    <StatItem count={postCount ?? posts.length} label={isRtl ? 'علامة' : 'Posts'} />
                    <StatItem count={followerCount} label={isRtl ? 'تابعوني' : 'Followers'} onClick={() => openFollowList('followers')} />
                    <StatItem count={followingCount} label={isRtl ? 'أتابعهم' : 'Following'} onClick={() => openFollowList('following')} />
                  </div>
                </div>

                {/* Action buttons beside identity */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* QR code button — always visible */}
                  <button
                    onClick={() => setShowQR(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-full transition active:scale-95"
                    style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-muted)', border: '1px solid var(--tr-border-soft)' }}
                    title={isRtl ? 'رمز QR' : 'QR Code'}
                  >
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/>
                      <rect x="3" y="14" width="7" height="7" rx="1.2"/>
                      <path strokeLinecap="round" d="M14 14h2M14 17h2M17 14v3M20 14v2M20 17v3M17 20h3"/>
                    </svg>
                  </button>
                  {isOwnProfile ? (
                    <SettingsBtn />
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          if (!user) { setShowGate(true); return; }
                          if (followLoading) return;
                          setFollowLoading(true);
                          const wasFollowing = isFollowing;
                          setIsFollowing(!wasFollowing);
                          setFollowerCount(c => wasFollowing ? Math.max(0, c - 1) : c + 1);
                          try {
                            const res = await fetch(`/api/tareeq/follow/${profileUser.id}`, { method: 'POST', credentials: 'include' });
                            if (res.ok) { const d = await res.json(); setIsFollowing(d.following); }
                            else { setIsFollowing(wasFollowing); setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1)); }
                          } catch {
                            setIsFollowing(wasFollowing); setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
                          } finally { setFollowLoading(false); }
                        }}
                        disabled={followLoading}
                        className="font-bold text-sm px-5 py-2 rounded-full transition active:scale-95"
                        style={isFollowing
                          ? { background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }
                          : { background: 'var(--tr-gold)', color: '#fff', border: '1px solid var(--tr-gold)' }}
                      >
                        {isFollowing ? (isRtl ? 'متابَع' : 'Following') : (isRtl ? 'تابع' : 'Follow')}
                      </button>
                      <button
                        onClick={handleSendMessage}
                        className="font-bold text-sm px-5 py-2 rounded-full transition active:scale-95"
                        style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
                      >
                        {isRtl ? 'رسالة' : 'Message'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Tab row ── */}
            <div className="flex mt-6" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <DeskTabBtn active={activeTab === 'posts'} onClick={() => handleTabChange('posts')}>
                {isRtl ? 'العلامات' : 'Posts'}
              </DeskTabBtn>
              {isOwnProfile && (
                <DeskTabBtn active={activeTab === 'bookmarks'} onClick={() => handleTabChange('bookmarks')}>
                  <svg className="inline w-3.5 h-3.5 me-1 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" />
                  </svg>
                  {isRtl ? 'المحفوظات' : 'Saved'}
                </DeskTabBtn>
              )}
            </div>

            {/* ── 2-column body ── */}
            <div className="flex gap-6 items-start mt-6 pb-12">

              {/* Feed column */}
              <div className="flex-1 min-w-0">
                {activeTab === 'posts' && (
                  posts.length === 0 ? postsEmpty : (
                    <>
                      <div className="flex flex-col gap-4">
                        {posts.map(post => (
                          <TareeqCard key={post.id} post={post} initialLiked={likedIds.has(post.id)} initialReaction={reactedPosts[post.id] ?? null} />
                        ))}
                      </div>
                      {cursor && <div ref={sentinelRef} className="h-4 mt-8" />}
                      {loading && (
                        <div className="flex justify-center mt-8">
                          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                        </div>
                      )}
                    </>
                  )
                )}
                {activeTab === 'bookmarks' && isOwnProfile && bookmarkContent}
              </div>

              {/* Info sidebar */}
              <div className="w-[300px] shrink-0 sticky" style={{ top: 80 }}>
                <div className="rounded-2xl p-5" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
                  <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--tr-text-primary)' }}>
                    {isRtl ? 'عن الحساب' : 'About'}
                  </h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--tr-overlay)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'عضو منذ' : 'Member since'}</p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-primary)' }}>{joinedLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--tr-overlay)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'إجمالي العلامات' : 'Total marks'}</p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--tr-text-primary)' }}>{postCount ?? posts.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MOBILE LAYOUT
      ════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden">
        {/* Cover */}
        <div className="relative w-full" style={{ height: 110, background: coverGradient }}>
          {(coverPreview ?? coverUrl) ? (
            <img src={coverPreview ?? coverUrl!} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)' }} />
          )}
          {isOwnProfile && (
            <label
              className="absolute bottom-2 end-3 flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 11, fontWeight: 600 }}
            >
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleCoverUpload} />
              {coverUploading ? (
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
              {isRtl ? 'غلاف' : 'Cover'}
            </label>
          )}
        </div>

        {/* Profile card */}
        <div className="relative max-w-2xl mx-auto px-4" style={{ marginTop: -32, zIndex: 1 }}>
          <div
            className="rounded-3xl px-5 pt-3 pb-6"
            style={{ background: 'var(--tr-surface)', boxShadow: '0 4px 32px var(--tr-shadow-card)', border: '1px solid var(--tr-border-subtle)' }}
          >
            {/* Avatar row */}
            <div className="flex items-start justify-between" style={{ marginTop: -44 }}>
              <AvatarEl size={96} />

              {/* Settings + QR (own profile) */}
              {isOwnProfile && (
                <div className="flex items-center gap-2 mt-14">
                  <button
                    onClick={() => setShowQR(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-full transition active:scale-95"
                    style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-muted)', border: '1px solid var(--tr-border-soft)' }}
                  >
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/>
                      <rect x="3" y="14" width="7" height="7" rx="1.2"/>
                      <path strokeLinecap="round" d="M14 14h2M14 17h2M17 14v3M20 14v2M20 17v3M17 20h3"/>
                    </svg>
                  </button>
                  <SettingsBtn />
                </div>
              )}

              {/* Follow/Message/QR buttons */}
              {!isOwnProfile && (
                <div className="flex gap-2 mt-14">
                  <button
                    onClick={async () => {
                      if (!user) { setShowGate(true); return; }
                      if (followLoading) return;
                      setFollowLoading(true);
                      const wasFollowing = isFollowing;
                      setIsFollowing(!wasFollowing);
                      setFollowerCount(c => wasFollowing ? Math.max(0, c - 1) : c + 1);
                      try {
                        const res = await fetch(`/api/tareeq/follow/${profileUser.id}`, { method: 'POST', credentials: 'include' });
                        if (res.ok) { const d = await res.json(); setIsFollowing(d.following); }
                        else { setIsFollowing(wasFollowing); setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1)); }
                      } catch {
                        setIsFollowing(wasFollowing); setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
                      } finally { setFollowLoading(false); }
                    }}
                    disabled={followLoading}
                    className="font-bold text-sm px-5 py-2 rounded-full transition active:scale-95"
                    style={isFollowing
                      ? { background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }
                      : { background: 'var(--tr-gold)', color: '#fff', border: '1px solid var(--tr-gold)' }}
                  >
                    {isFollowing ? (isRtl ? 'متابَع' : 'Following') : (isRtl ? 'تابع' : 'Follow')}
                  </button>
                  <button
                    onClick={handleSendMessage}
                    className="font-bold text-sm px-5 py-2 rounded-full transition active:scale-95"
                    style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
                  >
                    {isRtl ? 'رسالة' : 'Message'}
                  </button>
                  <button
                    onClick={() => setShowQR(true)}
                    className="w-9 h-9 flex items-center justify-center rounded-full transition active:scale-95"
                    style={{ background: 'var(--tr-raised)', color: 'var(--tr-text-muted)', border: '1px solid var(--tr-border-soft)' }}
                  >
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/>
                      <rect x="3" y="14" width="7" height="7" rx="1.2"/>
                      <path strokeLinecap="round" d="M14 14h2M14 17h2M17 14v3M20 14v2M20 17v3M17 20h3"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <h1 className="font-black text-xl mt-3" style={{ color: 'var(--tr-text-primary)' }}>{profileUser.name}</h1>

            <div className="flex gap-6 mt-4">
              <StatItem count={postCount ?? posts.length} label={isRtl ? 'علامة' : 'Posts'} />
              <StatItem count={followerCount} label={isRtl ? 'تابعوني' : 'Followers'} onClick={() => openFollowList('followers')} />
              <StatItem count={followingCount} label={isRtl ? 'أتابعهم' : 'Following'} onClick={() => openFollowList('following')} />
            </div>
          </div>

          {/* Tab nav */}
          <div
            className="flex mt-4 rounded-2xl overflow-hidden"
            style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
          >
            <TabBtn active={activeTab === 'posts'} onClick={() => handleTabChange('posts')}>
              {isRtl ? 'العلامات' : 'Posts'}
            </TabBtn>
            {isOwnProfile && (
              <TabBtn active={activeTab === 'bookmarks'} onClick={() => handleTabChange('bookmarks')}>
                <svg className="inline w-3.5 h-3.5 me-1 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" />
                </svg>
                {isRtl ? 'المحفوظات' : 'Saved'}
              </TabBtn>
            )}
          </div>

          {/* Feed / Bookmarks content */}
          <div className="py-4 pb-24">
            {activeTab === 'posts' && (
              posts.length === 0 ? postsEmpty : (
                <>
                  {postsHasImages ? (
                    <div className="grid grid-cols-2 gap-3">
                      {posts.map(post => (
                        post.imageUrl ? (
                          <GridImageCard key={post.id} post={post} liked={likedIds.has(post.id)} />
                        ) : (
                          <div key={post.id} className="col-span-2">
                            <TareeqCard post={post} initialLiked={likedIds.has(post.id)} initialReaction={reactedPosts[post.id] ?? null} />
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {posts.map(post => (
                        <TareeqCard key={post.id} post={post} initialLiked={likedIds.has(post.id)} initialReaction={reactedPosts[post.id] ?? null} />
                      ))}
                    </div>
                  )}
                  {cursor && <div ref={sentinelRef} className="h-4 mt-8" />}
                  {loading && (
                    <div className="flex justify-center mt-8">
                      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                    </div>
                  )}
                </>
              )
            )}
            {activeTab === 'bookmarks' && isOwnProfile && bookmarkContent}
          </div>
        </div>
      </div>

      {/* ── Shared modals ── */}
      {showCreate && <TareeqCreateModal onClose={() => setShowCreate(false)} onCreated={() => {}} />}
      {showGate && <TareeqLoginGate onClose={() => setShowGate(false)} />}

      {/* Followers / Following modal */}
      {followListType && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={() => setFollowListType(null)}>
          <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl flex flex-col" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', maxHeight: '75dvh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--tr-border-subtle)' }}>
              <h3 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
                {followListType === 'followers' ? (isRtl ? 'المتابِعون' : 'Followers') : (isRtl ? 'المتابَعون' : 'Following')}
              </h3>
              <button onClick={() => setFollowListType(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm" style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              {followListLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tr-border-soft)', borderTopColor: 'var(--tr-gold)' }} />
                </div>
              ) : followListUsers.length === 0 ? (
                <p className="text-center py-10 text-sm" style={{ color: 'var(--tr-text-muted)' }}>
                  {isRtl ? 'لا يوجد أحد بعد' : 'Nobody yet'}
                </p>
              ) : followListUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <button onClick={() => { setFollowListType(null); router.push(`/tareeq/u/${u.id}`); }} className="w-10 h-10 rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', border: '1.5px solid var(--tr-border-soft)' }}>
                    {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" /> : u.name.charAt(0)}
                  </button>
                  <button onClick={() => { setFollowListType(null); router.push(`/tareeq/u/${u.id}`); }} className="flex-1 min-w-0 text-start">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--tr-text-primary)' }}>{u.name}</p>
                  </button>
                  {user && u.id !== user.id && (
                    <button
                      onClick={() => toggleFollowFromList(u.id, u.isFollowedByViewer)}
                      className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition"
                      style={u.isFollowedByViewer
                        ? { background: 'var(--tr-overlay)', color: 'var(--tr-text-muted)', border: '1px solid var(--tr-border-soft)' }
                        : { background: 'var(--tr-gold)', color: '#fff' }
                      }
                    >
                      {u.isFollowedByViewer ? (isRtl ? 'تتابعه ✓' : 'Following') : (isRtl ? 'متابعة' : 'Follow')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QR Profile Modal */}
      {showQR && (
        <TareeqQRModal
          userId={profileUser.id}
          name={profileUser.name}
          avatarUrl={avatarPreview ?? (isOwnProfile ? (user?.avatarUrl ?? profileUser.avatarUrl) : profileUser.avatarUrl) ?? null}
          isRtl={isRtl}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}

function DeskTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-3 font-bold text-sm transition"
      style={active
        ? { color: 'var(--tr-gold)', borderBottom: '2px solid var(--tr-gold)', marginBottom: -1 }
        : { color: 'var(--tr-text-muted)', borderBottom: '2px solid transparent', marginBottom: -1 }}
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="flex-1 py-3 font-bold text-sm transition"
      onClick={onClick}
      style={active
        ? { color: 'var(--tr-gold)', background: 'var(--tr-gold-glow)' }
        : { color: 'var(--tr-text-muted)' }}
    >
      {children}
    </button>
  );
}

function StatItem({ count, label, onClick }: { count: number; label: string; onClick?: () => void }) {
  const content = (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-black text-lg" style={{ color: 'var(--tr-text-primary)' }}>
        {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
      </span>
      <span className="text-[11px]" style={{ color: 'var(--tr-text-muted)' }}>{label}</span>
    </div>
  );
  if (onClick) return <button onClick={onClick} className="transition active:scale-95">{content}</button>;
  return content;
}

function GridImageCard({ post, liked }: { post: TareeqPostSummary; liked: boolean }) {
  return (
    <Link href={`/tareeq/${post.id}`} className="block relative rounded-2xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
      <img src={post.imageUrl!} alt={post.title ?? ''} className="w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />
      <div className="absolute bottom-2 start-2 flex items-center gap-1 text-white" style={{ fontSize: 11, fontWeight: 700 }}>
        <svg className="w-3.5 h-3.5" fill={liked ? '#f43f5e' : 'none'} stroke={liked ? '#f43f5e' : 'white'} strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
        {post.likeCount > 0 && post.likeCount}
      </div>
    </Link>
  );
}
