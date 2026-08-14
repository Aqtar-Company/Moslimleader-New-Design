'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell, { useAdminContext } from '@/components/tareeq-admin/AdminShell';

// ── Types ──────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  lastSeen?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  joinedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  BANNED: 'محظور',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e' },
  SUSPENDED: { bg: 'rgba(234,179,8,0.1)',   text: '#eab308' },
  BANNED:    { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444' },
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8' };
  return (
    <span
      style={{
        background: color.bg,
        color: color.text,
        borderRadius: '6px',
        padding: '3px 10px',
        fontSize: '0.75rem',
        fontWeight: 700,
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: '#334155',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#94a3b8', fontWeight: 700, fontSize: '0.875rem',
        flexShrink: 0,
      }}
    >
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function UsersContent() {
  const router = useRouter();
  const { can } = useAdminContext();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);

    fetch(`/api/tareeq-admin/users?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setUsers(d.users ?? []);
        setTotalPages(d.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounce search
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  async function toggleSuspend(user: User) {
    if (!can('users.view')) return;
    setActionLoading(user.id);
    const isSuspended = user.status === 'SUSPENDED';
    try {
      await fetch(`/api/tareeq-admin/users/${user.id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: isSuspended ? 'unsuspend' : 'suspend' }),
      });
      fetchUsers();
    } catch {}
    finally { setActionLoading(null); }
  }

  const TABS = [
    { key: 'ALL',       label: 'الكل' },
    { key: 'ACTIVE',    label: 'نشط' },
    { key: 'SUSPENDED', label: 'موقوف' },
  ] as const;

  return (
    <div dir="rtl" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
          إدارة المستخدمين
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.3rem' }}>
          عرض وإدارة حسابات المستخدمين
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px' }}>🔍</span>
          <input
            type="text"
            placeholder="ابحث باسم المستخدم أو البريد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.6rem 2.25rem 0.6rem 0.75rem',
              color: '#f1f5f9',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
            onBlur={e => (e.currentTarget.style.borderColor = '#334155')}
          />
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', background: '#0f172a', borderRadius: '8px', padding: '3px' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                background: statusFilter === tab.key ? '#334155' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: statusFilter === tab.key ? '#f1f5f9' : '#94a3b8',
                padding: '0.4rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: statusFilter === tab.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.5fr auto auto auto',
            gap: '1rem',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid #334155',
            color: '#64748b',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <span>المستخدم</span>
          <span>البريد الإلكتروني</span>
          <span>آخر ظهور</span>
          <span>الحالة</span>
          <span>الإجراءات</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: '52px', background: '#334155', borderRadius: '8px', opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <p style={{ margin: 0 }}>لا يوجد مستخدمون مطابقون للبحث</p>
          </div>
        ) : (
          users.map((user, i) => (
            <div
              key={user.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.5fr auto auto auto',
                gap: '1rem',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                borderBottom: i < users.length - 1 ? '1px solid #1e293b' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Name + avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                <Avatar name={user.name} url={user.avatarUrl} />
                <span style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.name}
                </span>
              </div>

              {/* Email */}
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </span>

              {/* Last seen */}
              <span style={{ color: '#64748b', fontSize: '0.775rem', whiteSpace: 'nowrap' }}>
                {user.lastSeen ? new Date(user.lastSeen).toLocaleDateString('ar-EG') : '—'}
              </span>

              {/* Status */}
              <StatusBadge status={user.status} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={() => router.push(`/tareeq-admin/users/${user.id}`)}
                  style={{
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    color: '#f59e0b',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.775rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  عرض
                </button>
                {can('users.view') && (
                  <button
                    onClick={() => toggleSuspend(user)}
                    disabled={actionLoading === user.id}
                    style={{
                      background: user.status === 'SUSPENDED'
                        ? 'rgba(34,197,94,0.1)'
                        : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${user.status === 'SUSPENDED' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      color: user.status === 'SUSPENDED' ? '#22c55e' : '#ef4444',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.775rem',
                      cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      opacity: actionLoading === user.id ? 0.5 : 1,
                    }}
                  >
                    {user.status === 'SUSPENDED' ? 'رفع الإيقاف' : 'إيقاف'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: '#1e293b', border: '1px solid #334155', color: page === 1 ? '#334155' : '#94a3b8',
              borderRadius: '8px', padding: '0.5rem 1rem', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
            }}
          >
            السابق
          </button>
          {[...Array(Math.min(totalPages, 7))].map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  background: page === p ? '#f59e0b' : '#1e293b',
                  border: `1px solid ${page === p ? '#f59e0b' : '#334155'}`,
                  color: page === p ? '#0f172a' : '#94a3b8',
                  borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: page === p ? 700 : 400, minWidth: '36px',
                }}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              background: '#1e293b', border: '1px solid #334155',
              color: page === totalPages ? '#334155' : '#94a3b8',
              borderRadius: '8px', padding: '0.5rem 1rem', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
            }}
          >
            التالي
          </button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminShell>
      <UsersContent />
    </AdminShell>
  );
}
