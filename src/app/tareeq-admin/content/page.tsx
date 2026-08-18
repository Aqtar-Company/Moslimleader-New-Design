'use client';
import { useEffect, useState } from 'react';
import AdminShell from '@/components/tareeq-admin/AdminShell';

interface Post {
  id: string; content: string; category: string | null; isHidden: boolean;
  hiddenReason: string | null; createdAt: string;
  likeCount: number; commentCount: number; viewCount: number;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

interface Comment {
  id: string; content: string; isHidden: boolean; hiddenBy: string | null; createdAt: string;
  postId: string;
  post: { id: string; title: string | null; content: string } | null;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

type Tab = 'posts' | 'comments';

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('posts');

  // ── Posts state ──────────────────────────────────────────────
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [q, setQ] = useState('');
  const [hidden, setHidden] = useState<'all' | 'visible' | 'hidden'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalPost, setModalPost] = useState<Post | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ── Comments state ────────────────────────────────────────────
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [cq, setCq] = useState('');
  const [cHidden, setCHidden] = useState<'all' | 'visible' | 'hidden'>('all');
  const [cPage, setCPage] = useState(1);
  const [cTotal, setCTotal] = useState(0);

  const LIMIT = 20;

  // ── Loaders ───────────────────────────────────────────────────
  const loadPosts = async () => {
    setPostsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), hidden });
    if (q) params.set('q', q);
    const r = await fetch(`/api/tareeq-admin/posts?${params}`, { credentials: 'include' });
    if (r.ok) { const d = await r.json(); setPosts(d.posts ?? []); setTotal(d.total ?? 0); }
    setPostsLoading(false);
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    const params = new URLSearchParams({ page: String(cPage), limit: String(LIMIT), hidden: cHidden });
    if (cq) params.set('q', cq);
    const r = await fetch(`/api/tareeq-admin/comments?${params}`, { credentials: 'include' });
    if (r.ok) { const d = await r.json(); setComments(d.comments ?? []); setCTotal(d.total ?? 0); }
    setCommentsLoading(false);
  };

  useEffect(() => { if (tab === 'posts') loadPosts(); }, [page, hidden, tab]);
  useEffect(() => { if (tab === 'comments') loadComments(); }, [cPage, cHidden, tab]);

  // ── Actions ───────────────────────────────────────────────────
  const postAction = async (postId: string, act: 'hide' | 'unhide' | 'delete', reason?: string) => {
    setActionLoading(true);
    await fetch(`/api/tareeq-admin/posts/${postId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act, reason }),
    });
    setModalPost(null); setHideReason('');
    setActionLoading(false);
    loadPosts();
  };

  const commentAction = async (commentId: string, act: 'hide' | 'unhide' | 'delete') => {
    setActionLoading(true);
    await fetch(`/api/tareeq-admin/comments/${commentId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act }),
    });
    setActionLoading(false);
    loadComments();
  };

  const pages = Math.ceil(total / LIMIT);
  const cPages = Math.ceil(cTotal / LIMIT);

  return (
    <AdminShell>
      <div style={{ padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 24 }}>إدارة المحتوى</h1>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #334155', paddingBottom: 0 }}>
          {(['posts', 'comments'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === t ? 700 : 400, color: tab === t ? '#f59e0b' : '#64748b', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent', marginBottom: -1 }}>
              {t === 'posts' ? 'المنشورات' : 'التعليقات'}
            </button>
          ))}
        </div>

        {/* ── POSTS TAB ──────────────────────────────────────── */}
        {tab === 'posts' && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <form onSubmit={e => { e.preventDefault(); setPage(1); loadPosts(); }} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240 }}>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث في المنشورات…"
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', color: '#f1f5f9', fontSize: 14, outline: 'none' }} />
                <button type="submit" style={{ background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>بحث</button>
              </form>
              {(['all', 'visible', 'hidden'] as const).map(v => (
                <button key={v} onClick={() => { setHidden(v); setPage(1); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: hidden === v ? 700 : 400, background: hidden === v ? '#f59e0b22' : '#1e293b', color: hidden === v ? '#f59e0b' : '#94a3b8' }}>
                  {v === 'all' ? 'الكل' : v === 'visible' ? 'مرئي' : 'مخفي'}
                </button>
              ))}
            </div>

            {postsLoading ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>جاري التحميل…</div>
            ) : posts.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>لا توجد منشورات</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#1e293b', border: `1px solid ${p.isHidden ? '#7f1d1d' : '#334155'}`, borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{p.user?.name ?? 'مجهول'}</span>
                          {p.category && <span style={{ background: '#33415566', color: '#94a3b8', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>{p.category}</span>}
                          {p.isHidden && <span style={{ background: '#7f1d1d44', color: '#f87171', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>مخفي</span>}
                          <span style={{ fontSize: 11, color: '#475569', marginRight: 'auto' }}>{new Date(p.createdAt).toLocaleDateString('ar')}</span>
                        </div>
                        <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
                          {p.content}
                        </p>
                        {p.isHidden && p.hiddenReason && (
                          <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', background: '#7f1d1d22', borderRadius: 6, padding: '4px 10px' }}>سبب الإخفاء: {p.hiddenReason}</div>
                        )}
                        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: '#64748b' }}>
                          <span>❤️ {p.likeCount}</span><span>💬 {p.commentCount}</span><span>👁 {p.viewCount}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        {p.isHidden ? (
                          <button onClick={() => postAction(p.id, 'unhide')} style={btnStyle('#16a34a')}>إظهار</button>
                        ) : (
                          <button onClick={() => { setModalPost(p); setHideReason(''); }} style={btnStyle('#d97706')}>إخفاء</button>
                        )}
                        <button onClick={() => { if (confirm('هل أنت متأكد من الحذف؟')) postAction(p.id, 'delete'); }} style={btnStyle('#dc2626')}>حذف</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pages > 1 && <Pagination current={page} total={pages} onChange={setPage} />}
          </>
        )}

        {/* ── COMMENTS TAB ───────────────────────────────────── */}
        {tab === 'comments' && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <form onSubmit={e => { e.preventDefault(); setCPage(1); loadComments(); }} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240 }}>
                <input value={cq} onChange={e => setCq(e.target.value)} placeholder="بحث في التعليقات…"
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', color: '#f1f5f9', fontSize: 14, outline: 'none' }} />
                <button type="submit" style={{ background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>بحث</button>
              </form>
              {(['all', 'visible', 'hidden'] as const).map(v => (
                <button key={v} onClick={() => { setCHidden(v); setCPage(1); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: cHidden === v ? 700 : 400, background: cHidden === v ? '#f59e0b22' : '#1e293b', color: cHidden === v ? '#f59e0b' : '#94a3b8' }}>
                  {v === 'all' ? 'الكل' : v === 'visible' ? 'مرئي' : 'مخفي'}
                </button>
              ))}
            </div>

            {commentsLoading ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>جاري التحميل…</div>
            ) : comments.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>لا توجد تعليقات</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comments.map(c => (
                  <div key={c.id} style={{ background: '#1e293b', border: `1px solid ${c.isHidden ? '#7f1d1d' : '#334155'}`, borderRadius: 12, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{c.user?.name ?? 'مجهول'}</span>
                          {c.isHidden && <span style={{ background: '#7f1d1d44', color: '#f87171', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>مخفي</span>}
                          {c.isHidden && c.hiddenBy === 'auto-filter' && <span style={{ background: '#312e8144', color: '#a5b4fc', borderRadius: 99, padding: '1px 8px', fontSize: 11 }}>فلتر تلقائي</span>}
                          <span style={{ fontSize: 11, color: '#475569', marginRight: 'auto' }}>{new Date(c.createdAt).toLocaleDateString('ar')}</span>
                        </div>
                        <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>{c.content}</p>
                        {c.post && (
                          <div style={{ fontSize: 11, color: '#475569', background: '#0f172a', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                            على: {c.post.title ?? c.post.content.slice(0, 50) + '…'}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        {c.isHidden ? (
                          <button onClick={() => commentAction(c.id, 'unhide')} disabled={actionLoading} style={btnStyle('#16a34a')}>إظهار</button>
                        ) : (
                          <button onClick={() => commentAction(c.id, 'hide')} disabled={actionLoading} style={btnStyle('#d97706')}>إخفاء</button>
                        )}
                        <button onClick={() => { if (confirm('حذف التعليق؟')) commentAction(c.id, 'delete'); }} disabled={actionLoading} style={btnStyle('#dc2626')}>حذف</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cPages > 1 && <Pagination current={cPage} total={cPages} onChange={setCPage} />}
          </>
        )}

        {/* Hide post modal */}
        {modalPost && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 28, width: 400 }}>
              <h3 style={{ color: '#f1f5f9', marginBottom: 16, fontSize: 16, fontWeight: 700 }}>سبب الإخفاء</h3>
              <input value={hideReason} onChange={e => setHideReason(e.target.value)} placeholder="اكتب سبب الإخفاء (اختياري)…"
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => postAction(modalPost.id, 'hide', hideReason)} disabled={actionLoading} style={{ ...btnStyle('#d97706'), flex: 1, padding: '10px' }}>تأكيد الإخفاء</button>
                <button onClick={() => setModalPost(null)} style={{ flex: 1, background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer' }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
      {Array.from({ length: total }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onChange(p)}
          style={{ width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: current === p ? '#f59e0b' : '#1e293b', color: current === p ? '#0f172a' : '#94a3b8', fontWeight: current === p ? 700 : 400 }}>
          {p}
        </button>
      ))}
    </div>
  );
}

function btnStyle(bg: string) {
  return { background: bg + '22', color: bg, border: `1px solid ${bg}44`, borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
}
