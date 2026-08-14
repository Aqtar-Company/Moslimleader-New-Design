'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/tareeq-admin/AdminShell';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  muted: '#94a3b8',
  text: '#f1f5f9',
  gold: '#f59e0b',
};

interface BanRecord {
  id: string;
  type: string;
  reason: string;
  bannedBy: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  user: { id: string; name: string; email: string };
}

interface ReportRecord {
  id: string;
  targetType: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string };
}

interface SecurityData {
  suspendedUsers: number;
  activeBans: number;
  activeSessions: number;
  recentBans: BanRecord[];
  recentReports: ReportRecord[];
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: string;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>{label}</div>
        <div style={{ color, fontSize: 28, fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function banTypeBadge(type: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    PERMANENT: { label: 'دائم', color: '#fca5a5', bg: '#450a0a' },
    TEMPORARY: { label: 'مؤقت', color: '#fcd34d', bg: '#451a03' },
    RESTRICTED: { label: 'مقيّد', color: '#93c5fd', bg: '#0c1a4d' },
  };
  const s = map[type] ?? { label: type, color: C.muted, bg: C.border };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {s.label}
    </span>
  );
}

export default function SecurityPage() {
  const router = useRouter();
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/tareeq-admin/security', { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/tareeq-admin/login');
          return;
        }
        const json = await res.json();
        setData(json);
      })
      .catch(() => setError('فشل تحميل البيانات'))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AdminShell>
      <div dir="rtl" style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: 0 }}>
            🛡️ مركز الأمان
          </h1>
          <p style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
            مراقبة الحظر والبلاغات والجلسات النشطة
          </p>
        </div>

        {loading && (
          <div style={{ color: C.muted, textAlign: 'center', padding: 60 }}>جاري التحميل...</div>
        )}
        {error && (
          <div
            style={{
              background: '#450a0a',
              color: '#fca5a5',
              borderRadius: 10,
              padding: '14px 20px',
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                marginBottom: 32,
              }}
            >
              <StatCard
                label="الحظر النشط"
                value={data.activeBans ?? 0}
                color="#ef4444"
                icon="🚫"
              />
              <StatCard
                label="البلاغات المعلقة"
                value={data.recentReports?.length ?? 0}
                color="#f59e0b"
                icon="⚠️"
              />
              <StatCard
                label="جلسات المشرفين النشطة"
                value={data.activeSessions ?? 0}
                color="#3b82f6"
                icon="👤"
              />
            </div>

            {/* Alert banner if pending reports > 0 */}
            {(data.recentReports?.length ?? 0) > 0 && (
              <div
                style={{
                  background: '#451a03',
                  border: '1px solid #f59e0b66',
                  borderRadius: 10,
                  padding: '14px 20px',
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: '#fcd34d',
                  fontSize: 14,
                }}
              >
                <span style={{ fontSize: 20 }}>⚠️</span>
                <span>
                  يوجد <strong>{data.recentReports?.length}</strong> بلاغ معلق يحتاج مراجعة
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Recent Bans */}
              <div
                style={{
                  background: C.surface,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${C.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🚫</span>
                  <h2 style={{ color: C.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                    آخر عمليات الحظر
                  </h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#0f172a' }}>
                        {['المستخدم', 'النوع', 'السبب', 'التاريخ'].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '10px 14px',
                              color: C.muted,
                              fontWeight: 600,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentBans.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{ color: C.muted, textAlign: 'center', padding: 24 }}
                          >
                            لا توجد حظر حديث
                          </td>
                        </tr>
                      )}
                      {data.recentBans.map((ban) => (
                        <tr
                          key={ban.id}
                          style={{ borderTop: `1px solid ${C.border}` }}
                        >
                          <td style={{ padding: '10px 14px', color: C.text }}>
                            {ban.user?.name ?? '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>{banTypeBadge(ban.type)}</td>
                          <td
                            style={{
                              padding: '10px 14px',
                              color: C.muted,
                              maxWidth: 160,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ban.reason}
                          </td>
                          <td
                            style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap' }}
                          >
                            {formatDate(ban.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Reports */}
              <div
                style={{
                  background: C.surface,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${C.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>📋</span>
                  <h2 style={{ color: C.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
                    أحدث البلاغات
                  </h2>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {data.recentReports.length === 0 && (
                    <div style={{ color: C.muted, textAlign: 'center', padding: 24 }}>
                      لا توجد بلاغات معلقة
                    </div>
                  )}
                  {data.recentReports.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: '14px 20px',
                        borderBottom: `1px solid ${C.border}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            background: '#451a0344',
                            color: '#fcd34d',
                            borderRadius: 999,
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {r.targetType}
                        </span>
                        <span style={{ color: C.muted, fontSize: 12 }}>
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                      <div style={{ color: C.text, fontSize: 13 }}>{r.reason}</div>
                      <div style={{ color: C.muted, fontSize: 12 }}>
                        بواسطة: {r.reporter?.name ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
