'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { compressImage } from '@/lib/compress-image';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';
import TareeqCreateModal from '@/components/tareeq/TareeqCreateModal';
import TareeqLoginGate from '@/components/tareeq/TareeqLoginGate';
import TareeqHeader from '@/components/tareeq/TareeqHeader';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProfileUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
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

  // Follow list modal
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followListUsers, setFollowListUsers] = useState<{ id: string; name: string; avatarUrl?: string | null; isFollowedByViewer: boolean }[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const isOwnProfile = user?.id === profileUser.id;

  // Avatar upload
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);

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

  return (
    <TareeqNotificationsProvider>
    <div className="min-h-screen" style={{ background: 'var(--tr-base)' }}>
      <TareeqHeader onCreateClick={handleCreateClick} />

      {/* Cover */}
      <div className="relative w-full" style={{ height: 110, background: coverGradient }}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)' }} />
      </div>

      {/* Profile card */}
      <div className="relative max-w-2xl mx-auto px-4" style={{ marginTop: -32, zIndex: 1 }}>
        <div
          className="rounded-3xl px-5 pt-3 pb-6"
          style={{ background: 'var(--tr-surface)', boxShadow: '0 4px 32px rgba(0,0,0,0.08)', border: '1px solid var(--tr-border-subtle)' }}
        >
          {/* Avatar row */}
          <div className="flex items-start justify-between" style={{ marginTop: -44 }}>
            <div className="relative shrink-0">
              {(avatarPreview || user?.avatarUrl || profileUser.avatarUrl) ? (
                <img
                  src={avatarPreview ?? (isOwnProfile ? (user?.avatarUrl ?? profileUser.avatarUrl ?? '') : (profileUser.avatarUrl ?? ''))}
                  alt={profileUser.name}
                  className="w-24 h-24 rounded-full object-cover"
                  style={{ border: '4px solid var(--tr-surface)', boxShadow: '0 0 0 3px var(--tr-gold)' }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black"
                  style={{ background: coverGradient, color: '#fff', border: '4px solid var(--tr-surface)', boxShadow: '0 0 0 3px var(--tr-gold)' }}
                >
                  {profileUser.name.charAt(0)}
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <svg className="w-16 h-16 -rotate-90 absolute" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 27}`}
                      strokeDashoffset={`${2 * Math.PI * 27 * (1 - avatarProgress / 100)}`}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s ease' }} />
                  </svg>
                  <span className="text-white font-black text-xs relative z-10">{avatarProgress}%</span>
                </div>
              )}
              {isOwnProfile && !avatarUploading && (
                <label
                  className="absolute bottom-0 end-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition active:scale-90"
                  style={{ background: 'var(--tr-gold)', border: '2px solid var(--tr-surface)' }}
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarUpload} />
                  <svg className="w-4 h-4" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </label>
              )}
            </div>

            {/* Follow/Message buttons */}
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
              🔖 {isRtl ? 'المحفوظات' : 'Saved'}
            </TabBtn>
          )}
        </div>

        {/* Feed / Bookmarks content */}
        <div className="py-4 pb-28 sm:pb-8">

          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            posts.length === 0 ? (
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
            ) : (
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

          {/* BOOKMARKS TAB */}
          {activeTab === 'bookmarks' && isOwnProfile && (
            <>
              {/* Folder drill-down header */}
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

              {/* Folder grid view */}
              {!activeFolderId && (
                bmFoldersLoading ? (
                  <div className="flex flex-col gap-3">
                    {skeletons.slice(0, 3).map((_, i) => (
                      <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--tr-surface)' }} />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Create folder button + inline input */}
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

                    {/* "All saved" shortcut */}
                    <button
                      onClick={() => { setActiveFolderId('__all__'); setActiveFolderName(isRtl ? 'كل المحفوظات' : 'All saved'); loadBmPosts(null); }}
                      className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl mb-3 transition text-start"
                      style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--tr-overlay)' }}>🔖</div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'كل المحفوظات' : 'All saved'}</p>
                        <p className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{isRtl ? 'جميع العلامات المحفوظة' : 'All bookmarked marks'}</p>
                      </div>
                    </button>

                    {bmFolders.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-2xl mb-3">🔖</p>
                        <p className="font-semibold text-sm" style={{ color: 'var(--tr-text-secondary)' }}>
                          {isRtl ? 'لا توجد تصنيفات بعد' : 'No folders yet'}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: 'var(--tr-text-muted)' }}>
                          {isRtl ? 'اضغط على 🔖 في أي منشور لحفظه وإنشاء تصنيف' : 'Tap 🔖 on any post to save it and create folders'}
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
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--tr-overlay)' }}>📁</div>
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

              {/* Posts inside a folder */}
              {activeFolderId && (
                bmPostsLoading ? (
                  <div className="flex flex-col gap-4">
                    {skeletons.map((_, i) => <TareeqCardSkeleton key={i} />)}
                  </div>
                ) : bmPosts.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-2xl mb-3">📭</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--tr-text-secondary)' }}>
                      {isRtl ? 'لا توجد علامات في هذا التصنيف' : 'No marks in this folder'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {bmPosts.map(bm => (
                      <TareeqCard key={bm.id} post={bm.post} initialBookmarked={true} initialReaction={reactedPosts[bm.post.id] ?? null} />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

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
    </div>
    </TareeqNotificationsProvider>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="flex-1 py-3 font-bold text-sm transition"
      onClick={onClick}
      style={active
        ? { color: 'var(--tr-gold)', borderBottom: '2px solid var(--tr-gold)' }
        : { color: 'var(--tr-text-muted)', borderBottom: '2px solid transparent' }}
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
