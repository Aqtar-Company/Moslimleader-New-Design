'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';

interface Folder { id: string; name: string; _count: { bookmarks: number }; }
interface Bookmark {
  id: string;
  post: TareeqPostSummary & { user: { id: string; name: string; avatarUrl?: string | null }; _count: { likes: number; comments: number } };
  folder?: { id: string; name: string } | null;
  createdAt: string;
}

export default function TareeqSavedClient() {
  const { isRtl } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get('folder');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?next=/tareeq/saved'); return; }
    // Load folders
    fetch('/api/tareeq/bookmark-folders', { credentials: 'include' })
      .then(r => r.json()).then(d => setFolders(d.folders ?? [])).catch(() => {});
    // Load bookmarks
    const url = activeFolderId ? `/api/tareeq/bookmarks?folderId=${activeFolderId}` : '/api/tareeq/bookmarks';
    setLoading(true);
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setBookmarks(d.bookmarks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, activeFolderId, router]);

  const activeFolder = folders.find(f => f.id === activeFolderId);

  return (
    <div className="max-w-[1280px] mx-auto px-4 pt-6 pb-16 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">

      {/* Folders sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-[84px]">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              <h2 className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'المحفوظات' : 'Saved'}</h2>
            </div>
            <div className="py-2">
              <Link href="/tareeq/saved"
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl mx-1 transition-colors"
                style={{ background: !activeFolderId ? 'var(--tr-gold-glow)' : 'transparent', color: !activeFolderId ? 'var(--tr-gold)' : 'var(--tr-text-secondary)', fontWeight: !activeFolderId ? 700 : 600, textDecoration: 'none' }}
                onMouseEnter={e => { if (activeFolderId) (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
                onMouseLeave={e => { if (activeFolderId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: !activeFolderId ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                <span className="text-sm">{isRtl ? 'كل المحفوظات' : 'All Saved'}</span>
              </Link>
              {folders.map(f => (
                <Link key={f.id} href={`/tareeq/saved?folder=${f.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl mx-1 transition-colors"
                  style={{ background: activeFolderId === f.id ? 'var(--tr-gold-glow)' : 'transparent', color: activeFolderId === f.id ? 'var(--tr-gold)' : 'var(--tr-text-secondary)', fontWeight: activeFolderId === f.id ? 700 : 600, textDecoration: 'none' }}
                  onMouseEnter={e => { if (activeFolderId !== f.id) (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'; }}
                  onMouseLeave={e => { if (activeFolderId !== f.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: activeFolderId === f.id ? 'var(--tr-gold)' : 'var(--tr-text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{f.name}</span>
                    <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)' }}>{f._count.bookmarks}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/tareeq" className="flex items-center justify-center w-9 h-9 rounded-full transition" style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-secondary)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--tr-surface)'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3' : 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18'} />
            </svg>
          </Link>
          <div>
            <h1 className="font-black text-xl" style={{ color: 'var(--tr-text-primary)' }}>
              {activeFolder ? activeFolder.name : (isRtl ? 'المحفوظات' : 'Saved')}
            </h1>
            {!loading && <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>{bookmarks.length} {isRtl ? 'علامة محفوظة' : 'saved marks'}</p>}
          </div>
        </div>

        {/* Mobile folder pills */}
        {folders.length > 0 && (
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: 'none' }}>
            <Link href="/tareeq/saved" className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition"
              style={{ background: !activeFolderId ? 'var(--tr-gold)' : 'var(--tr-surface)', color: !activeFolderId ? '#fff' : 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)', textDecoration: 'none' }}>
              {isRtl ? 'الكل' : 'All'}
            </Link>
            {folders.map(f => (
              <Link key={f.id} href={`/tareeq/saved?folder=${f.id}`} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition"
                style={{ background: activeFolderId === f.id ? 'var(--tr-gold)' : 'var(--tr-surface)', color: activeFolderId === f.id ? '#fff' : 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)', textDecoration: 'none' }}>
                {f.name}
              </Link>
            ))}
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 4 }).map((_, i) => <TareeqCardSkeleton key={i} />)}</div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-14 h-14 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            <p className="font-semibold" style={{ color: 'var(--tr-text-secondary)' }}>
              {isRtl ? 'لا علامات محفوظة' : 'No saved marks'}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--tr-text-muted)' }}>
              {isRtl ? 'احفظ العلامات التي تريد العودة إليها' : 'Save marks you want to revisit'}
            </p>
            <Link href="/tareeq" className="inline-block mt-6 px-6 py-2.5 rounded-xl font-bold text-sm transition"
              style={{ background: 'var(--tr-gold)', color: '#fff', textDecoration: 'none' }}>
              {isRtl ? 'استكشف طريق' : 'Explore Tareeq'}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {bookmarks.map(bm => (
              <TareeqCard key={bm.id} post={bm.post as unknown as TareeqPostSummary} initialBookmarked />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
