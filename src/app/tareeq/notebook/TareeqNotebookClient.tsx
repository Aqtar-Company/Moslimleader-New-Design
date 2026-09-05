'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

interface Note {
  id: string;
  title: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const AUTOSAVE_DELAY = 1200; // ms

export default function TareeqNotebookClient() {
  const { isRtl } = useLang();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [notes, setNotes]           = useState<Note[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [isNew, setIsNew]           = useState(false); // editing a brand-new unsaved note
  const [editTitle, setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving]         = useState(false);
  const [searchQ, setSearchQ]       = useState('');
  const [sort, setSort]             = useState<'newest' | 'oldest'>('newest');
  const [showMobileEditor, setShowMobileEditor] = useState(false);

  const autosaveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitle = useRef('');
  const lastSavedContent = useRef('');
  const requestIdRef   = useRef(0);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/tareeq/login?redirect=/tareeq/notebook');
  }, [user, authLoading, router]);

  const fetchNotes = useCallback(async (q?: string, s?: string) => {
    setLoading(true);
    const reqId = ++requestIdRef.current;
    const params = new URLSearchParams({ sort: s ?? sort, limit: '50' });
    if (q) params.set('q', q);
    try {
      const res = await fetch(`/api/tareeq/notes?${params}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (reqId !== requestIdRef.current) return; // stale — newer request already in flight
      setNotes(data.notes ?? []);
    } catch { /* ignore */ }
    finally { if (reqId === requestIdRef.current) setLoading(false); }
  }, [sort]);

  useEffect(() => {
    if (!authLoading && user) fetchNotes();
  }, [user, authLoading, fetchNotes]);

  // Search with 500ms debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearch(q: string) {
    setSearchQ(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchNotes(q, sort), 500);
  }

  function handleSortChange(s: 'newest' | 'oldest') {
    setSort(s);
    fetchNotes(searchQ || undefined, s);
  }

  // Open a note for editing
  function openNote(note: Note) {
    setActiveId(note.id);
    setIsNew(false);
    setEditTitle(note.title ?? '');
    setEditContent(note.content);
    lastSavedTitle.current   = note.title ?? '';
    lastSavedContent.current = note.content;
    setShowMobileEditor(true);
  }

  // Start new note
  function startNew() {
    setActiveId(null);
    setIsNew(true);
    setEditTitle('');
    setEditContent('');
    lastSavedTitle.current   = '';
    lastSavedContent.current = '';
    setShowMobileEditor(true);
  }

  const saveNote = useCallback(async () => {
    if (!editContent.trim() && !editTitle.trim()) return;
    setSaving(true);
    const body = { title: editTitle.trim() || null, content: editContent.trim() };
    try {
      if (isNew) {
        const res  = await fetch('/api/tareeq/notes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (data.note) {
          setNotes(prev => [data.note, ...prev]);
          setActiveId(data.note.id);
          setIsNew(false);
          lastSavedTitle.current   = editTitle;
          lastSavedContent.current = editContent;
        }
      } else if (activeId) {
        const res  = await fetch(`/api/tareeq/notes/${activeId}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (data.note) {
          setNotes(prev => prev.map(n => n.id === activeId ? data.note : n));
          lastSavedTitle.current   = editTitle;
          lastSavedContent.current = editContent;
        }
      }
    } catch { /* network error — saving indicator cleared below */ }
    finally { setSaving(false); }
  }, [editContent, editTitle, isNew, activeId]);

  // Autosave on change — depends on saveNote so closure is always fresh
  useEffect(() => {
    const dirty = editTitle !== lastSavedTitle.current || editContent !== lastSavedContent.current;
    if (!dirty) return;
    if (!editContent.trim() && !editTitle.trim()) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => saveNote(), AUTOSAVE_DELAY);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [editTitle, editContent, saveNote]);

  async function deleteNote(id: string) {
    if (!confirm(isRtl ? 'حذف هذه الملاحظة؟' : 'Delete this note?')) return;
    const res = await fetch(`/api/tareeq/notes/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) return;
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setIsNew(false);
      setShowMobileEditor(false);
    }
  }

  // Convert note to post — flush pending autosave first, then pre-fill create modal
  async function convertToPost() {
    if (!editContent.trim()) return;
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    await saveNote();
    try { sessionStorage.setItem('tareeq-share-prefill', [editTitle.trim(), editContent.trim()].filter(Boolean).join('\n')); } catch { /* private mode */ }
    router.push('/tareeq?action=create');
  }

  async function closeMobileEditor() {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    await saveNote();
    setShowMobileEditor(false);
    setActiveId(null);
    setIsNew(false);
  }

  if (authLoading) return null;

  const activeNote = notes.find(n => n.id === activeId) ?? null;

  return (
    <div
      className="max-w-[1280px] mx-auto px-3 pt-5 pb-20 lg:grid lg:pb-8"
      style={{ gridTemplateColumns: '260px minmax(0,1fr)', gap: 20 }}
    >
      {/* ── Sidebar: note list ── */}
      <aside className={`${showMobileEditor ? 'hidden lg:flex' : 'flex'} flex-col gap-3`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-black text-base" style={{ color: 'var(--tr-text-primary)' }}>
            {isRtl ? '📓 دفتري' : '📓 My Notebook'}
          </h1>
          <button
            onClick={startNew}
            className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90"
            style={{ background: 'var(--tr-gold)', color: '#fff' }}
            title={isRtl ? 'ملاحظة جديدة' : 'New note'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--tr-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
            placeholder={isRtl ? 'بحث في الملاحظات…' : 'Search notes…'}
            className="w-full ps-9 pe-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', color: 'var(--tr-text-primary)' }}
          />
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          {(['newest', 'oldest'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleSortChange(s)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{
                background: sort === s ? 'var(--tr-gold-glow)' : 'var(--tr-raised)',
                color: sort === s ? 'var(--tr-gold)' : 'var(--tr-text-muted)',
                border: sort === s ? '1px solid var(--tr-gold-dim)' : '1px solid var(--tr-border-soft)',
              }}
            >
              {s === 'newest' ? (isRtl ? 'الأحدث' : 'Newest') : (isRtl ? 'الأقدم' : 'Oldest')}
            </button>
          ))}
        </div>

        {/* Note list */}
        <div className="flex flex-col gap-1.5">
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--tr-raised)' }} />
          ))}

          {!loading && notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: 'var(--tr-text-muted)' }}>
              <span className="text-4xl opacity-40">📓</span>
              <p className="text-sm text-center">
                {searchQ
                  ? (isRtl ? 'لا نتائج' : 'No results')
                  : (isRtl ? 'لا ملاحظات بعد — ابدأ بكتابة أفكارك' : 'No notes yet — start writing')}
              </p>
              {searchQ && searchQ.trim().length < 4 && (
                <p className="text-xs text-center px-4" style={{ color: 'var(--tr-text-muted)', opacity: 0.7 }}>
                  {isRtl
                    ? 'جرّب كلمة أطول (٤ أحرف فأكثر) للحصول على نتائج أدق'
                    : 'Try a longer term (4+ chars) for better results'}
                </p>
              )}
              {!searchQ && (
                <button onClick={startNew} className="text-sm font-bold px-4 py-2 rounded-xl transition active:scale-95" style={{ background: 'var(--tr-gold)', color: '#fff' }}>
                  {isRtl ? '+ ملاحظة جديدة' : '+ New note'}
                </button>
              )}
            </div>
          )}

          {!loading && notes.map(note => (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              className="w-full text-start px-3 py-2.5 rounded-xl transition"
              style={{
                background: activeId === note.id ? 'var(--tr-gold-glow)' : 'var(--tr-raised)',
                border: activeId === note.id ? '1px solid var(--tr-gold-dim)' : '1px solid transparent',
              }}
            >
              <p className="text-sm font-bold truncate" style={{ color: 'var(--tr-text-primary)' }}>
                {note.title || (isRtl ? '(بدون عنوان)' : '(Untitled)')}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--tr-text-muted)' }}>
                {note.content.slice(0, 80)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--tr-text-muted)' }}>
                {new Date(note.updatedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Editor panel ── */}
      <main
        className={`${showMobileEditor ? 'flex' : 'hidden lg:flex'} flex-col rounded-2xl overflow-hidden`}
        style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)', minHeight: 520 }}
      >
        {/* Editor toolbar */}
        {(isNew || activeId) ? (
          <>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
              {/* Mobile back */}
              <button onClick={closeMobileEditor} className="lg:hidden w-11 h-11 rounded-full flex items-center justify-center" style={{ color: 'var(--tr-text-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
                </svg>
              </button>

              <span className="flex-1 text-xs" style={{ color: 'var(--tr-text-muted)' }}>
                {saving
                  ? (isRtl ? 'جاري الحفظ…' : 'Saving…')
                  : (activeId || isNew) && editContent.trim()
                    ? (isRtl ? '✓ تم الحفظ تلقائياً' : '✓ Auto-saved')
                    : ''}
              </span>

              {/* Convert to post */}
              <button
                onClick={convertToPost}
                disabled={!editContent.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-40"
                style={{ background: 'var(--tr-gold)', color: '#fff' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                {isRtl ? 'حوّلها إلى علامة' : 'Post as Tareeq'}
              </button>

              {/* Delete */}
              {activeId && (
                <button onClick={() => deleteNote(activeId)} className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-red-500/10" style={{ color: 'var(--tr-text-muted)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            {/* Title */}
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder={isRtl ? 'العنوان (اختياري)' : 'Title (optional)'}
              className="w-full px-5 pt-4 pb-2 text-lg font-bold outline-none bg-transparent"
              style={{ color: 'var(--tr-text-primary)' }}
              dir="auto"
            />

            {/* Content */}
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder={isRtl ? 'اكتب فكرتك هنا…\n\nمساحة خاصة لأفكارك قبل أن تتحول إلى علامة.' : 'Write your thoughts here…\n\nA private space for ideas before they become a post.'}
              className="flex-1 w-full px-5 py-2 resize-none outline-none bg-transparent text-sm leading-relaxed"
              style={{ color: 'var(--tr-text-primary)', minHeight: 380 }}
              dir="auto"
              autoFocus
            />
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16" style={{ color: 'var(--tr-text-muted)' }}>
            <span className="text-5xl opacity-30 select-none">📓</span>
            <p className="text-sm text-center max-w-[220px] leading-relaxed">
              {isRtl
                ? 'اختر ملاحظة أو أنشئ واحدة جديدة'
                : 'Select a note or create a new one'}
            </p>
            <button
              onClick={startNew}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
              style={{ background: 'var(--tr-gold)', color: '#fff' }}
            >
              {isRtl ? '+ ملاحظة جديدة' : '+ New note'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
