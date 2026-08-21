'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string; email: string };
  targetPost: { id: string; content: string; isHidden: boolean; authorName: string } | null;
  targetComment: { id: string; content: string; isHidden: boolean } | null;
  targetUser: { id: string; name: string; email: string; tareeqSuspended: boolean } | null;
}

interface Post {
  id: string;
  content: string;
  authorName: string;
  category: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  _count: { reports: number };
}

interface TareeqUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  tareeqSuspended: boolean;
  tareeqSuspendedAt: string | null;
  tareeqSuspendReason: string | null;
  createdAt: string;
  _count: { tareeqPosts: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', padding: '24px 20px', paddingBottom: 60 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '14px 16px', marginBottom: 10 },
  input: { padding: '9px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  btn: (color: string, text = '#0f172a') => ({ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', background: color, color: text }),
  badge: (color: string) => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: color + '22', color }),
};

const STATUS_COLOR: Record<string, string> = { PENDING: '#f59e0b', REVIEWED: '#60a5fa', RESOLVED: '#22c55e', DISMISSED: '#94a3b8' };
const STATUS_AR: Record<string, string> = { PENDING: 'بانتظار المراجعة', REVIEWED: 'قيد المراجعة', RESOLVED: 'تمت المعالجة', DISMISSED: 'مرفوض' };
const TYPE_AR: Record<string, string> = { post: 'منشور', comment: 'تعليق', user: 'مستخدم' };

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminTareeqPage() {
  const [tab, setTab] = useState<'reports' | 'posts' | 'users'>('reports');
  const [msg, setMsg] = useState('');

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 2500); }

  return (
    <div dir="rtl" style={S.page}>
      {msg && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 700, zIndex: 9999 }}>
          {msg}
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#d4a843', marginBottom: 4 }}>إدارة طريق</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>إشراف على البلاغات والمنشورات والمستخدمين</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['reports', 'posts', 'users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
              background: tab === t ? '#d4a843' : '#1e293b', color: tab === t ? '#0f172a' : '#94a3b8' }}>
            {t === 'reports' ? '🚨 البلاغات' : t === 'posts' ? '📝 المنشورات' : '👤 المستخدمون'}
          </button>
        ))}
      </div>

      {tab === 'reports' && <ReportsTab flash={flash} />}
      {tab === 'posts' && <PostsTab flash={flash} />}
      {tab === 'users' && <UsersTab flash={flash} />}
    </div>
  );
}

// ─── Reports Tab ─────────────────────────────────────────────────────────────

function ReportsTab({ flash }: { flash: (t: string) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/tareeq/reports?status=${statusFilter}&page=${page}`);
    if (res.ok) {
      const d = await res.json();
      setReports(d.reports);
      setTotal(d.total);
    }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: string) {
    setActioningId(id);
    const res = await fetch('/api/admin/tareeq/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    setActioningId(null);
    if (res.ok) {
      flash(action === 'dismiss' ? 'تم رفض البلاغ' : 'تمت المعالجة ✓');
      await load();
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ ...S.input, width: 'auto', minWidth: 160 }}>
          <option value="PENDING">بانتظار المراجعة</option>
          <option value="RESOLVED">تمت المعالجة</option>
          <option value="DISMISSED">مرفوض</option>
          <option value="all">الكل</option>
        </select>
        <span style={{ fontSize: 13, color: '#64748b' }}>{total} بلاغ</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>جاري التحميل...</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>لا توجد بلاغات</div>
      ) : (
        reports.map(r => (
          <div key={r.id} style={S.card}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={S.badge('#f59e0b')}>{TYPE_AR[r.targetType] ?? r.targetType}</span>
                <span style={S.badge(STATUS_COLOR[r.status] ?? '#94a3b8')}>{STATUS_AR[r.status] ?? r.status}</span>
              </div>
              <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(r.createdAt).toLocaleDateString('ar-EG')}</span>
            </div>

            {/* Reporter */}
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
              بلاغ من: <span style={{ color: '#94a3b8' }}>{r.reporter.name} ({r.reporter.email})</span>
            </p>

            {/* Reason */}
            <p style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>السبب: {r.reason}</p>
            {r.description && <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{r.description}</p>}

            {/* Target preview */}
            {r.targetPost && (
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, borderRight: '3px solid #f59e0b' }}>
                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>المنشور — {r.targetPost.authorName} {r.targetPost.isHidden ? '🚫 مخفي' : ''}</p>
                <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{r.targetPost.content.slice(0, 200)}{r.targetPost.content.length > 200 ? '...' : ''}</p>
              </div>
            )}
            {r.targetComment && (
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, borderRight: '3px solid #60a5fa' }}>
                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>التعليق {r.targetComment.isHidden ? '🚫 مخفي' : ''}</p>
                <p style={{ fontSize: 13, color: '#cbd5e1' }}>{r.targetComment.content.slice(0, 200)}</p>
              </div>
            )}
            {r.targetUser && (
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, borderRight: '3px solid #a78bfa' }}>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>المستخدم: {r.targetUser.name} — {r.targetUser.email} {r.targetUser.tareeqSuspended ? '🔴 موقوف' : ''}</p>
              </div>
            )}

            {/* Actions */}
            {r.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {r.targetType === 'post' && !r.targetPost?.isHidden && (
                  <button onClick={() => act(r.id, 'hide_post')} disabled={actioningId === r.id} style={S.btn('#f59e0b')}>إخفاء المنشور</button>
                )}
                {r.targetType === 'post' && (
                  <button onClick={() => { if (confirm('حذف المنشور نهائياً؟')) act(r.id, 'delete_post'); }} disabled={actioningId === r.id} style={S.btn('#ef4444', '#fff')}>حذف المنشور</button>
                )}
                {r.targetType === 'comment' && !r.targetComment?.isHidden && (
                  <button onClick={() => act(r.id, 'hide_comment')} disabled={actioningId === r.id} style={S.btn('#f59e0b')}>إخفاء التعليق</button>
                )}
                {r.targetType === 'user' && !r.targetUser?.tareeqSuspended && (
                  <button onClick={() => act(r.id, 'suspend_user')} disabled={actioningId === r.id} style={S.btn('#a78bfa')}>تعليق المستخدم</button>
                )}
                <button onClick={() => act(r.id, 'dismiss')} disabled={actioningId === r.id} style={S.btn('#334155', '#94a3b8')}>رفض البلاغ</button>
              </div>
            )}
          </div>
        ))
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.btn('#1e293b', '#f1f5f9')}>السابق</button>
          <span style={{ padding: '7px 12px', color: '#94a3b8', fontSize: 13 }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.btn('#1e293b', '#f1f5f9')}>التالي</button>
        </div>
      )}
    </div>
  );
}

// ─── Posts Tab ────────────────────────────────────────────────────────────────

function PostsTab({ flash }: { flash: (t: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [hiddenFilter, setHiddenFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    if (hiddenFilter) params.set('hidden', hiddenFilter);
    const res = await fetch(`/api/admin/tareeq/posts?${params}`);
    if (res.ok) {
      const d = await res.json();
      setPosts(d.posts);
      setTotal(d.total);
    }
    setLoading(false);
  }, [q, hiddenFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function toggleHide(post: Post) {
    setActioning(post.id);
    const res = await fetch('/api/admin/tareeq/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id, isHidden: !post.isHidden }),
    });
    setActioning(null);
    if (res.ok) {
      flash(post.isHidden ? 'تم إظهار المنشور' : 'تم إخفاء المنشور');
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isHidden: !post.isHidden } : p));
    }
  }

  async function deletePost(id: string) {
    if (!confirm('حذف المنشور نهائياً؟')) return;
    setActioning(id);
    const res = await fetch('/api/admin/tareeq/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setActioning(null);
    if (res.ok) {
      flash('تم حذف المنشور');
      setPosts(prev => prev.filter(p => p.id !== id));
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
          placeholder="بحث في المحتوى..."
          style={{ ...S.input, flex: 1, minWidth: 180 }} />
        <select value={hiddenFilter} onChange={e => { setHiddenFilter(e.target.value); setPage(1); }}
          style={{ ...S.input, width: 'auto', minWidth: 140 }}>
          <option value="">كل المنشورات</option>
          <option value="true">المخفية فقط</option>
          <option value="false">الظاهرة فقط</option>
        </select>
        <button onClick={load} style={S.btn('#d4a843')}>بحث</button>
        <span style={{ padding: '7px 0', fontSize: 13, color: '#64748b' }}>{total} منشور</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>جاري التحميل...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>لا توجد منشورات</div>
      ) : (
        posts.map(post => (
          <div key={post.id} style={{ ...S.card, borderRight: post.isHidden ? '3px solid #ef4444' : '3px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  {post.isHidden && <span style={S.badge('#ef4444')}>🚫 مخفي</span>}
                  {post.category && <span style={S.badge('#60a5fa')}>{post.category}</span>}
                  {post._count.reports > 0 && <span style={S.badge('#f59e0b')}>{post._count.reports} بلاغ</span>}
                </div>
                <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 6 }}>
                  {post.content.slice(0, 180)}{post.content.length > 180 ? '...' : ''}
                </p>
                <p style={{ fontSize: 11, color: '#64748b' }}>
                  {post.user?.name ?? post.authorName} • {new Date(post.createdAt).toLocaleDateString('ar-EG')} • 👁 {post.viewCount} ❤️ {post.likeCount} 💬 {post.commentCount}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, shrinkWrap: 0 }}>
                <button onClick={() => toggleHide(post)} disabled={actioning === post.id}
                  style={S.btn(post.isHidden ? '#22c55e' : '#f59e0b')}>
                  {post.isHidden ? 'إظهار' : 'إخفاء'}
                </button>
                <button onClick={() => deletePost(post.id)} disabled={actioning === post.id}
                  style={S.btn('#ef4444', '#fff')}>حذف</button>
              </div>
            </div>
            {post.isHidden && post.hiddenReason && (
              <p style={{ fontSize: 11, color: '#ef4444' }}>سبب الإخفاء: {post.hiddenReason}</p>
            )}
          </div>
        ))
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.btn('#1e293b', '#f1f5f9')}>السابق</button>
          <span style={{ padding: '7px 12px', color: '#94a3b8', fontSize: 13 }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.btn('#1e293b', '#f1f5f9')}>التالي</button>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ flash }: { flash: (t: string) => void }) {
  const [users, setUsers] = useState<TareeqUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [suspendedOnly, setSuspendedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    if (suspendedOnly) params.set('suspended', 'true');
    const res = await fetch(`/api/admin/tareeq/users?${params}`);
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users);
      setTotal(d.total);
    }
    setLoading(false);
  }, [q, suspendedOnly, page]);

  useEffect(() => { load(); }, [load]);

  async function toggleSuspend(user: TareeqUser) {
    setActioning(user.id);
    const res = await fetch('/api/admin/tareeq/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, tareeqSuspended: !user.tareeqSuspended }),
    });
    setActioning(null);
    if (res.ok) {
      flash(user.tareeqSuspended ? 'تم رفع التعليق ✓' : 'تم تعليق المستخدم ✓');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, tareeqSuspended: !user.tareeqSuspended } : u));
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
          placeholder="بحث بالاسم أو الإيميل..."
          style={{ ...S.input, flex: 1, minWidth: 200 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
          <input type="checkbox" checked={suspendedOnly} onChange={e => { setSuspendedOnly(e.target.checked); setPage(1); }} />
          الموقوفون فقط
        </label>
        <button onClick={load} style={S.btn('#d4a843')}>بحث</button>
        <span style={{ fontSize: 13, color: '#64748b' }}>{total} مستخدم</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>جاري التحميل...</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>لا توجد نتائج</div>
      ) : (
        users.map(user => (
          <div key={user.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#334155', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#d4a843' }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : user.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{user.name}</p>
                {user.tareeqSuspended && <span style={S.badge('#ef4444')}>🔴 موقوف</span>}
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{user.email}</p>
              <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>
                {user._count.tareeqPosts} منشور
                {user.tareeqSuspended && user.tareeqSuspendReason && ` • سبب: ${user.tareeqSuspendReason}`}
              </p>
            </div>
            <button onClick={() => toggleSuspend(user)} disabled={actioning === user.id}
              style={S.btn(user.tareeqSuspended ? '#22c55e' : '#ef4444', '#fff')}>
              {user.tareeqSuspended ? 'رفع التعليق' : 'تعليق'}
            </button>
          </div>
        ))
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.btn('#1e293b', '#f1f5f9')}>السابق</button>
          <span style={{ padding: '7px 12px', color: '#94a3b8', fontSize: 13 }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={S.btn('#1e293b', '#f1f5f9')}>التالي</button>
        </div>
      )}
    </div>
  );
}
