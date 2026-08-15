'use client';
import { useEffect, useState } from 'react';
import AdminShell from '@/components/tareeq-admin/AdminShell';

interface Post {
  id: string; content: string; category: string | null; isHidden: boolean;
  hiddenReason: string | null; createdAt: string;
  likeCount: number; commentCount: number; viewCount: number;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

export default function ContentPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [hidden, setHidden] = useState<'all' | 'visible' | 'hidden'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalPost, setModalPost] = useState<Post | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const LIMIT = 20;

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), hidden });
    if (q) params.set('q', q);
    const r = await fetch(`/api/tareeq-admin/posts?${params}`, { credentials: 'include' });
    if (r.ok) { const d = await r.json(); setPosts(d.posts ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, hidden]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(); };

  const action = async (postId: string, act: 'hide' | 'unhide' | 'delete', reason?: string) => {
    setActionLoading(true);
    await fetch(`/api/tareeq-admin/posts/${postId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act, reason }),
    });
    setModalPost(null); setHideReason('');
    setActionLoading(false);
    load();
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <AdminShell>
      <div style={{ padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 24 }}>إدارة المحتوى</h1>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث في المحتوى…"
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

        {loading ? (
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
                      <button onClick={() => action(p.id, 'unhide')} style={btnStyle('#16a34a')}>إظهار</button>
                    ) : (
                      <button onClick={() => { setModalPost(p); setHideReason(''); }} style={btnStyle('#d97706')}>إخفاء</button>
                    )}
                    <button onClick={() => { if (confirm('هل أنت متأكد من الحذف؟')) action(p.id, 'delete'); }} style={btnStyle('#dc2626')}>حذف</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: page === p ? '#f59e0b' : '#1e293b', color: page === p ? '#0f172a' : '#94a3b8', fontWeight: page === p ? 700 : 400 }}>{p}</button>
            ))}
          </div>
        )}

        {/* Hide modal */}
        {modalPost && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 28, width: 400 }}>
              <h3 style={{ color: '#f1f5f9', marginBottom: 16, fontSize: 16, fontWeight: 700 }}>سبب الإخفاء</h3>
              <input value={hideReason} onChange={e => setHideReason(e.target.value)} placeholder="اكتب سبب الإخفاء (اختياري)…"
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => action(modalPost.id, 'hide', hideReason)} disabled={actionLoading} style={{ ...btnStyle('#d97706'), flex: 1, padding: '10px' }}>تأكيد الإخفاء</button>
                <button onClick={() => setModalPost(null)} style={{ flex: 1, background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer' }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function btnStyle(bg: string) {
  return { background: bg + '22', color: bg, border: `1px solid ${bg}44`, borderRadius: 8, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
}
