'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/tareeq-admin/AdminShell';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  activeUsers24h: number;
  registrationsToday: number;
  bannedUsers: number;
  totalPosts: number;
  postsToday: number;
  hiddenPosts: number;
  pendingReports: number;
}

interface Report {
  id: string;
  reporterName: string;
  targetType: 'POST' | 'COMMENT' | 'USER';
  targetPreview: string;
  reason: string;
  createdAt: string;
  status: string;
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: string;
  color: string;
  loading: boolean;
}) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid #334155',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>{label}</span>
        <div
          style={{
            width: '36px', height: '36px',
            background: `${color}20`,
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px',
          }}
        >
          {icon}
        </div>
      </div>
      {loading ? (
        <div style={{ height: '32px', background: '#334155', borderRadius: '6px', width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <div style={{ color: color, fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
          {(value ?? 0).toLocaleString('ar-EG')}
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Reason tag color ───────────────────────────────────────────────────────────

const REASON_COLORS: Record<string, string> = {
  SPAM: '#f59e0b',
  HARASSMENT: '#ef4444',
  HATE_SPEECH: '#dc2626',
  VIOLENCE: '#b91c1c',
  NUDITY: '#8b5cf6',
  MISINFORMATION: '#3b82f6',
  COPYRIGHT: '#06b6d4',
  OTHER: '#94a3b8',
};

const REASON_LABELS: Record<string, string> = {
  SPAM: 'بريد مزعج',
  HARASSMENT: 'مضايقة',
  HATE_SPEECH: 'خطاب كراهية',
  VIOLENCE: 'عنف',
  NUDITY: 'محتوى صريح',
  MISINFORMATION: 'معلومات مضللة',
  COPYRIGHT: 'انتهاك حقوق',
  OTHER: 'أخرى',
};

const TARGET_LABELS: Record<string, string> = {
  POST: 'منشور',
  COMMENT: 'تعليق',
  USER: 'مستخدم',
};

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tareeq-admin/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.stats) return;
        const s = d.stats;
        setStats({
          totalUsers: s.users?.total ?? 0,
          activeUsers24h: s.users?.active24h ?? 0,
          registrationsToday: s.users?.newToday ?? 0,
          bannedUsers: s.users?.suspended ?? 0,
          totalPosts: s.posts?.total ?? 0,
          postsToday: s.posts?.today ?? 0,
          hiddenPosts: s.posts?.hidden ?? 0,
          pendingReports: s.reports?.pending ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));

    fetch('/api/tareeq-admin/reports?status=PENDING&limit=5', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setReports((d.reports ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        reporterName: (r.reporter as { name?: string } | null)?.name ?? 'مجهول',
        targetPreview: (r.targetPost as { content?: string } | null)?.content
          ?? (r.targetComment as { content?: string } | null)?.content
          ?? (r.targetUser as { name?: string } | null)?.name
          ?? '—',
      }))))
      .catch(() => {})
      .finally(() => setReportsLoading(false));
  }, []);

  const STAT_CARDS = [
    { label: 'إجمالي المستخدمين', key: 'totalUsers',        icon: '👥', color: '#3b82f6' },
    { label: 'نشطون (24 ساعة)',   key: 'activeUsers24h',    icon: '🟢', color: '#22c55e' },
    { label: 'تسجيلات اليوم',     key: 'registrationsToday', icon: '📈', color: '#06b6d4' },
    { label: 'المحظورون',          key: 'bannedUsers',        icon: '🚫', color: '#ef4444' },
    { label: 'إجمالي المنشورات',  key: 'totalPosts',         icon: '📝', color: '#8b5cf6' },
    { label: 'منشورات اليوم',      key: 'postsToday',         icon: '✨', color: '#f97316' },
    { label: 'المنشورات المخفية',  key: 'hiddenPosts',        icon: '🙈', color: '#eab308' },
    { label: 'البلاغات المعلقة',   key: 'pendingReports',     icon: '🚨', color: '#ef4444' },
  ] as const;

  return (
    <AdminShell>
      <div dir="rtl" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Page title */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            لوحة التحكم
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.3rem' }}>
            نظرة عامة على حالة المنصة
          </p>
        </div>

        {/* Stat grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {STAT_CARDS.map(card => (
            <StatCard
              key={card.key}
              label={card.label}
              icon={card.icon}
              color={card.color}
              value={stats?.[card.key]}
              loading={statsLoading}
            />
          ))}
        </div>

        {/* Pending reports */}
        <div
          style={{
            background: '#1e293b',
            borderRadius: '12px',
            border: '1px solid #334155',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '18px' }}>🚨</span>
              <h2 style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                أحدث البلاغات المعلقة
              </h2>
            </div>
            <a
              href="/tareeq-admin/reports"
              style={{
                color: '#f59e0b',
                fontSize: '0.8rem',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              عرض الكل ←
            </a>
          </div>

          {reportsLoading ? (
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: '60px', background: '#334155', borderRadius: '8px', opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
              <p style={{ margin: 0 }}>لا توجد بلاغات معلقة</p>
            </div>
          ) : (
            <div>
              {reports.map((report, i) => (
                <div
                  key={report.id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderBottom: i < reports.length - 1 ? '1px solid #1e293b' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Target type badge */}
                  <span
                    style={{
                      background: '#334155',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {TARGET_LABELS[report.targetType] ?? report.targetType}
                  </span>

                  {/* Preview */}
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <div style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {report.targetPreview}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                      بواسطة: {report.reporterName}
                    </div>
                  </div>

                  {/* Reason tag */}
                  <span
                    style={{
                      background: `${REASON_COLORS[report.reason] ?? '#94a3b8'}20`,
                      color: REASON_COLORS[report.reason] ?? '#94a3b8',
                      border: `1px solid ${REASON_COLORS[report.reason] ?? '#94a3b8'}40`,
                      borderRadius: '6px',
                      padding: '2px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {REASON_LABELS[report.reason] ?? report.reason}
                  </span>

                  {/* Date */}
                  <span style={{ color: '#64748b', fontSize: '0.75rem', flexShrink: 0 }}>
                    {new Date(report.createdAt).toLocaleDateString('ar-EG')}
                  </span>

                  {/* Action */}
                  <a
                    href={`/tareeq-admin/reports`}
                    style={{
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      color: '#f59e0b',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '0.775rem',
                      textDecoration: 'none',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    مراجعة
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
