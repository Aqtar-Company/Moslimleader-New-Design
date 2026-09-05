'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import TareeqCard, { TareeqPostSummary } from '@/components/tareeq/TareeqCard';
import TareeqCardSkeleton from '@/components/tareeq/TareeqCardSkeleton';
import TareeqPostSheet from '@/components/tareeq/TareeqPostSheet';

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
  const [sheetPostId, setSheetPostId] = useState<string | null>(null);
  const [focusComments, setFocusComments] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/tareeq/login?redirect=/tareeq/saved'); return; }
    fetch('/api/tareeq/bookmark-folders', { credentials: 'include' })
      .then(r => r.json()).then(d => setFolders(d.folders ?? [])).catch(() => {});
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
    <div className="max-w-[680px] mx-auto pb-16">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10"
        style={{ background: 'var(--tr-surface)', borderBottom: '1px solid var(--tr-border-subtle)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/tareeq"
            className="flex items-center justify-center w-8 h-8 rounded-full transition shrink-0"
            style={{ background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--tr-raised)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--tr-overlay)'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3' : 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18'} />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg leading-tight" style={{ color: 'var(--tr-text-primary)' }}>
              {activeFolder ? activeFolder.name : (isRtl ? 'المحفوظات' : 'Saved')}
            </h1>
            {!loading && (
              <p className="text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                {bookmarks.length} {isRtl ? 'علامة محفوظة' : 'saved marks'}
              </p>
            )}
          </div>
        </div>

        {/* Folder pills */}
        {folders.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
            <Link href="/tareeq/saved"
              className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition"
              style={{ background: !activeFolderId ? 'var(--tr-gold)' : 'var(--tr-overlay)', color: !activeFolderId ? '#fff' : 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)', textDecoration: 'none' }}>
              {isRtl ? 'الكل' : 'All'}
            </Link>
            {folders.map(f => (
              <Link key={f.id} href={`/tareeq/saved?folder=${f.id}`}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition"
                style={{ background: activeFolderId === f.id ? 'var(--tr-gold)' : 'var(--tr-overlay)', color: activeFolderId === f.id ? '#fff' : 'var(--tr-text-secondary)', border: '1px solid var(--tr-border-soft)', textDecoration: 'none' }}>
                {f.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="px-4 pt-4 flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <TareeqCardSkeleton key={i} />)
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
            <Link href="/tareeq" className="inline-block mt-6 px-6 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'var(--tr-gold)', color: '#fff', textDecoration: 'none' }}>
              {isRtl ? 'استكشف طريق' : 'Explore Tareeq'}
            </Link>
          </div>
        ) : (
          bookmarks.map(bm => (
            <TareeqCard
              key={bm.id}
              post={bm.post as unknown as TareeqPostSummary}
              initialBookmarked
              onMobileOpen={(id, fc) => { setSheetPostId(id); setFocusComments(!!fc); }}
            />
          ))
        )}
      </div>

      {sheetPostId && (
        <TareeqPostSheet
          postId={sheetPostId}
          focusComments={focusComments}
          onClose={() => setSheetPostId(null)}
        />
      )}
    </div>
  );
}
