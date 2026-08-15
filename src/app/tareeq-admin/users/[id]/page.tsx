'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminShell, { useAdminContext } from '@/components/tareeq-admin/AdminShell';

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  joinedAt: string;
  lastSeen?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  postCount: number;
  commentCount: number;
  followerCount: number;
  suspensionReason?: string;
  suspendedUntil?: string;
}

interface Post {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
}

interface BanRecord {
  id: string;
  reason: string;
  type: 'TEMPORARY' | 'PERMANENT';
  createdAt: string;
  adminName: string;
  liftedAt?: string;
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function SuspendModal({
  type,
  onConfirm,
  onCancel,
}: {
  type: 'TEMPORARY' | 'PERMANENT';
  onConfirm: (reason: string, days?: number) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        dir="rtl"
        style={{
          background: '#1e293b', borderRadius: '12px', border: '1px solid #334155',
          padding: '1.5rem', width: '100%', maxWidth: '440px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ color: '#f1f5f9', margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>
          {type === 'PERMANENT' ? '⛔ إيقاف دائم' : '⏱️ إيقاف مؤقت'}
        </h3>

        {type === 'TEMPORARY' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
              مدة الإيقاف (أيام)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              style={{
                width: '100%', background: '#0f172a', border: '1px solid #334155',
                borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f1f5f9',
                fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.4rem' }}>
            سبب الإيقاف
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="أدخل سبب الإيقاف..."
            style={{
              width: '100%', background: '#0f172a', border: '1px solid #334155',
              borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f1f5f9',
              fontSize: '0.875rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
            onBlur={e => (e.currentTarget.style.borderColor = '#334155')}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
          <button
            onClick={() => reason.trim() && onConfirm(reason, type === 'TEMPORARY' ? days : undefined)}
            disabled={!reason.trim()}
            style={{
              background: '#ef4444', border: 'none', borderRadius: '8px',
              color: '#fff', padding: '0.6rem 1.25rem', cursor: reason.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem', fontWeight: 700,
              opacity: reason.trim() ? 1 : 0.5,
            }}
          >
            تأكيد الإيقاف
          </button>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent', border: '1px solid #334155', borderRadius: '8px',
              color: '#94a3b8', padding: '0.6rem 1.25rem', cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User detail content ────────────────────────────────────────────────────────

function UserDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { can } = useAdminContext();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [banHistory, setBanHistory] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'TEMPORARY' | 'PERMANENT' | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tareeq-admin/users/${userId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const raw = d.user ?? d;
        setUser({
          id: raw.id,
          name: raw.name,
          email: raw.email,
          avatarUrl: raw.avatarUrl,
          joinedAt: raw.createdAt,
          lastSeen: raw.tareeqLastSeen,
          status: raw.tareeqSuspended ? 'SUSPENDED' : 'ACTIVE',
          postCount: raw._count?.tareeqPosts ?? 0,
          commentCount: raw._count?.tareeqComments ?? 0,
          followerCount: raw._count?.tareeqFollowers ?? 0,
          suspensionReason: raw.tareeqSuspendReason,
        });
        setBanHistory(
          (raw.tareeqBans ?? []).map((b: Record<string, unknown>) => ({
            id: b.id,
            reason: b.reason,
            type: b.type,
            createdAt: b.createdAt,
            adminName: String(b.bannedBy ?? '—'),
            liftedAt: b.liftedAt,
          }))
        );
      })
      .catch(() => setError('تعذّر تحميل بيانات المستخدم'))
      .finally(() => setLoading(false));
  }, [userId]);

  async function doAction(action: string, extra?: object) {
    // Map UI action names to API action names
    const apiAction = action === 'force-logout' ? 'force_logout' : action;
    setActionLoading(action);
    try {
      const res = await fetch(`/api/tareeq-admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: apiAction, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'خطأ');
      // Refresh user data
      const ud = await fetch(`/api/tareeq-admin/users/${userId}`, { credentials: 'include' }).then(r => r.json());
      const raw = ud.user ?? ud;
      setUser(prev => prev ? {
        ...prev,
        status: raw.tareeqSuspended ? 'SUSPENDED' : 'ACTIVE',
        suspensionReason: raw.tareeqSuspendReason,
      } : prev);
      setBanHistory(
        (raw.tareeqBans ?? []).map((b: Record<string, unknown>) => ({
          id: b.id, reason: b.reason, type: b.type, createdAt: b.createdAt,
          adminName: String(b.bannedBy ?? '—'), liftedAt: b.liftedAt,
        }))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setActionLoading(null);
    }
  }

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    ACTIVE:    { bg: 'rgba(34,197,94,0.1)',  text: '#22c55e' },
    SUSPENDED: { bg: 'rgba(234,179,8,0.1)',  text: '#eab308' },
    BANNED:    { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444' },
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <p>جارٍ التحميل...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
        <p>{error || 'المستخدم غير موجود'}</p>
        <button
          onClick={() => router.back()}
          style={{ marginTop: '1rem', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          العودة
        </button>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[user.status] ?? STATUS_COLORS.ACTIVE;

  return (
    <>
      {modal && (
        <SuspendModal
          type={modal}
          onConfirm={(reason) => {
            setModal(null);
            doAction('suspend', { reason });
          }}
          onCancel={() => setModal(null)}
        />
      )}

      <div dir="rtl" style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Back button */}
        <button
          onClick={() => router.push('/tareeq-admin/users')}
          style={{
            background: 'transparent', border: 'none', color: '#94a3b8',
            cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: 0,
          }}
        >
          ← العودة للمستخدمين
        </button>

        {/* User card */}
        <div
          style={{
            background: '#1e293b', borderRadius: '12px', border: '1px solid #334155',
            padding: '1.5rem', marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: '#334155', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '2rem', color: '#94a3b8',
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                <h1 style={{ color: '#f1f5f9', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                  {user.name}
                </h1>
                <span style={{
                  background: statusColor.bg, color: statusColor.text,
                  borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {{ ACTIVE: 'نشط', SUSPENDED: 'موقوف', BANNED: 'محظور' }[user.status]}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', direction: 'ltr', textAlign: 'right' }}>{user.email}</div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'المنشورات', value: user.postCount },
                  { label: 'التعليقات', value: user.commentCount },
                  { label: 'المتابعون', value: user.followerCount },
                ].map(stat => (
                  <div key={stat.label} style={{ textAlign: 'center' }}>
                    <div style={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700 }}>
                      {stat.value.toLocaleString('ar-EG')}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-end' }}>
              <div>انضم: <span style={{ color: '#cbd5e1' }}>{new Date(user.joinedAt).toLocaleDateString('ar-EG')}</span></div>
              {user.lastSeen && (
                <div>آخر ظهور: <span style={{ color: '#cbd5e1' }}>{new Date(user.lastSeen).toLocaleDateString('ar-EG')}</span></div>
              )}
              {user.suspensionReason && (
                <div style={{ maxWidth: '200px', textAlign: 'right' }}>
                  سبب الإيقاف: <span style={{ color: '#eab308' }}>{user.suspensionReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {can('users.view') && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', borderTop: '1px solid #334155', paddingTop: '1.25rem' }}>
              {user.status === 'SUSPENDED' || user.status === 'BANNED' ? (
                <ActionBtn
                  label="رفع الإيقاف"
                  color="#22c55e"
                  disabled={!!actionLoading}
                  loading={actionLoading === 'unsuspend'}
                  onClick={() => doAction('unsuspend')}
                />
              ) : (
                <>
                  <ActionBtn
                    label="إيقاف مؤقت"
                    color="#eab308"
                    disabled={!!actionLoading}
                    loading={actionLoading === 'suspend'}
                    onClick={() => setModal('TEMPORARY')}
                  />
                  <ActionBtn
                    label="إيقاف دائم"
                    color="#ef4444"
                    disabled={!!actionLoading}
                    loading={actionLoading === 'ban'}
                    onClick={() => setModal('PERMANENT')}
                  />
                </>
              )}
              <ActionBtn
                label="تسجيل خروج إجباري"
                color="#94a3b8"
                disabled={!!actionLoading}
                loading={actionLoading === 'force-logout'}
                onClick={() => doAction('force-logout')}
              />
            </div>
          )}
        </div>

        {/* Recent posts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #334155' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                📝 أحدث المنشورات
              </h2>
            </div>
            {posts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>لا توجد منشورات</div>
            ) : (
              posts.map((post, i) => (
                <div key={post.id} style={{ padding: '0.85rem 1.25rem', borderBottom: i < posts.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  <div style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '0.3rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {post.content}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {new Date(post.createdAt).toLocaleDateString('ar-EG')} · {post.likeCount} ❤️
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ban history */}
          <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #334155' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                🚫 سجل الإيقافات
              </h2>
            </div>
            {banHistory.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>لا يوجد سجل إيقافات</div>
            ) : (
              banHistory.map((record, i) => (
                <div key={record.id} style={{ padding: '0.85rem 1.25rem', borderBottom: i < banHistory.length - 1 ? '1px solid #1e293b' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{
                      background: record.type === 'PERMANENT' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                      color: record.type === 'PERMANENT' ? '#ef4444' : '#eab308',
                      borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      {record.type === 'PERMANENT' ? 'دائم' : 'مؤقت'}
                    </span>
                    {record.liftedAt && (
                      <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                        مرفوع
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: '0.2rem' }}>{record.reason}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {record.adminName} · {new Date(record.createdAt).toLocaleDateString('ar-EG')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ActionBtn({
  label, color, onClick, disabled, loading,
}: {
  label: string; color: string; onClick: () => void; disabled: boolean; loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: `${color}15`,
        border: `1px solid ${color}30`,
        color,
        borderRadius: '8px',
        padding: '0.55rem 1.1rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.875rem',
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s',
      }}
    >
      {loading ? '...' : label}
    </button>
  );
}

export default function UserDetailPage() {
  return (
    <AdminShell>
      <UserDetailContent />
    </AdminShell>
  );
}
