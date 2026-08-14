'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/tareeq-admin/AdminShell';

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';

interface Report {
  id: string;
  reporterName: string;
  reporterAvatarUrl?: string;
  targetType: 'POST' | 'COMMENT' | 'USER';
  targetPreview: string;
  targetId: string;
  reason: string;
  description?: string;
  createdAt: string;
  status: ReportStatus;
  resolvedBy?: string;
  resolvedAt?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REASON_COLORS: Record<string, string> = {
  SPAM:            '#f59e0b',
  HARASSMENT:      '#ef4444',
  HATE_SPEECH:     '#dc2626',
  VIOLENCE:        '#b91c1c',
  NUDITY:          '#8b5cf6',
  MISINFORMATION:  '#3b82f6',
  COPYRIGHT:       '#06b6d4',
  OTHER:           '#94a3b8',
};

const REASON_LABELS: Record<string, string> = {
  SPAM:           'بريد مزعج',
  HARASSMENT:     'مضايقة',
  HATE_SPEECH:    'خطاب كراهية',
  VIOLENCE:       'عنف',
  NUDITY:         'محتوى صريح',
  MISINFORMATION: 'معلومات مضللة',
  COPYRIGHT:      'انتهاك حقوق',
  OTHER:          'أخرى',
};

const TARGET_LABELS: Record<string, string> = {
  POST:    'منشور',
  COMMENT: 'تعليق',
  USER:    'مستخدم',
};

const STATUS_TABS: { key: ReportStatus; label: string; icon: string }[] = [
  { key: 'PENDING',   label: 'معلق',         icon: '🟡' },
  { key: 'REVIEWED',  label: 'قيد المراجعة', icon: '🔵' },
  { key: 'RESOLVED',  label: 'محلول',         icon: '✅' },
  { key: 'DISMISSED', label: 'مرفوض',         icon: '❌' },
];

// ── Report card ────────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onAction,
  actionLoading,
}: {
  report: Report;
  onAction: (id: string, action: 'resolve' | 'reject') => void;
  actionLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const reasonColor = REASON_COLORS[report.reason] ?? '#94a3b8';

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid #334155',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Main row */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Reporter avatar */}
          <div
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: '#334155', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, fontSize: '0.875rem', color: '#94a3b8', fontWeight: 700,
            }}
          >
            {report.reporterName.charAt(0).toUpperCase()}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
              <span style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600 }}>
                {report.reporterName}
              </span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>أبلغ عن</span>
              <span style={{
                background: '#334155', color: '#cbd5e1',
                borderRadius: '4px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 600,
              }}>
                {TARGET_LABELS[report.targetType] ?? report.targetType}
              </span>
            </div>

            {/* Target preview */}
            <div style={{
              color: '#94a3b8', fontSize: '0.8rem',
              background: '#0f172a', borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.5rem',
              borderRight: `3px solid ${reasonColor}`,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: expanded ? undefined : 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {report.targetPreview}
            </div>

            {report.description && (
              <div style={{ color: '#64748b', fontSize: '0.775rem', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>ملاحظة: </span>{report.description}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Reason tag */}
              <span style={{
                background: `${reasonColor}15`,
                color: reasonColor,
                border: `1px solid ${reasonColor}30`,
                borderRadius: '6px',
                padding: '2px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {REASON_LABELS[report.reason] ?? report.reason}
              </span>

              {/* Date */}
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                {new Date(report.createdAt).toLocaleDateString('ar-EG', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </span>

              {/* Expand toggle */}
              {report.targetPreview.length > 100 && (
                <button
                  onClick={() => setExpanded(x => !x)}
                  style={{
                    background: 'none', border: 'none', color: '#f59e0b',
                    fontSize: '0.75rem', cursor: 'pointer', padding: 0,
                  }}
                >
                  {expanded ? 'طي ▲' : 'عرض أكثر ▼'}
                </button>
              )}
            </div>
          </div>

          {/* Actions — only for pending/under_review */}
          {(report.status === 'PENDING' || report.status === 'REVIEWED') && (
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'flex-start' }}>
              <button
                onClick={() => onAction(report.id, 'resolve')}
                disabled={actionLoading === report.id}
                style={{
                  background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                  color: '#22c55e', borderRadius: '8px', padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem', fontWeight: 700, cursor: actionLoading === report.id ? 'not-allowed' : 'pointer',
                  opacity: actionLoading === report.id ? 0.5 : 1, whiteSpace: 'nowrap',
                }}
              >
                {actionLoading === report.id ? '...' : '✓ حل البلاغ'}
              </button>
              <button
                onClick={() => onAction(report.id, 'reject')}
                disabled={actionLoading === report.id}
                style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  color: '#ef4444', borderRadius: '8px', padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem', fontWeight: 700, cursor: actionLoading === report.id ? 'not-allowed' : 'pointer',
                  opacity: actionLoading === report.id ? 0.5 : 1, whiteSpace: 'nowrap',
                }}
              >
                ✕ رفض
              </button>
            </div>
          )}

          {/* Resolved info */}
          {(report.status === 'RESOLVED' || report.status === 'DISMISSED') && report.resolvedBy && (
            <div style={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>
              {report.status === 'RESOLVED' ? '✅' : '🚫'} {report.resolvedBy}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function ReportsContent() {
  const [activeTab, setActiveTab] = useState<ReportStatus>('PENDING');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [counts, setCounts] = useState<Partial<Record<ReportStatus, number>>>({});

  const fetchReports = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ status: activeTab, page: String(page), limit: '10' });
    fetch(`/api/tareeq-admin/reports?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setReports((d.reports ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          reporterName: (r.reporter as { name?: string } | null)?.name ?? 'مجهول',
          targetPreview: (r.targetPost as { content?: string } | null)?.content
            ?? (r.targetComment as { content?: string } | null)?.content
            ?? (r.targetUser as { name?: string } | null)?.name
            ?? '—',
        })));
        setTotalPages(d.pages ?? 1);
        if (d.counts) setCounts(d.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function handleAction(id: string, action: 'resolve' | 'reject') {
    const status = action === 'resolve' ? 'RESOLVED' : 'DISMISSED';
    setActionLoading(id);
    try {
      await fetch(`/api/tareeq-admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      // Remove from current list
      setReports(prev => prev.filter(r => r.id !== id));
      // Update counts
      setCounts(prev => ({
        ...prev,
        [activeTab]: Math.max(0, (prev[activeTab] ?? 1) - 1),
        [status]: (prev[status as ReportStatus] ?? 0) + 1,
      }));
    } catch {}
    finally { setActionLoading(null); }
  }

  return (
    <div dir="rtl" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
          البلاغات
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.3rem' }}>
          مراجعة وإدارة بلاغات المستخدمين
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', background: '#1e293b', borderRadius: '10px', padding: '4px', border: '1px solid #334155', flexWrap: 'wrap' }}>
        {STATUS_TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                background: isActive ? '#334155' : 'transparent',
                border: 'none',
                borderRadius: '7px',
                color: isActive ? '#f1f5f9' : '#94a3b8',
                padding: '0.6rem 1rem',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span style={{
                  background: tab.key === 'PENDING' ? '#ef4444' : '#334155',
                  color: tab.key === 'PENDING' ? '#fff' : '#94a3b8',
                  borderRadius: '10px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Report list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: '120px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div
          style={{
            background: '#1e293b', borderRadius: '12px', border: '1px solid #334155',
            padding: '4rem', textAlign: 'center', color: '#94a3b8',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            {activeTab === 'PENDING' ? '✅' : '📭'}
          </div>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            {activeTab === 'PENDING' ? 'لا توجد بلاغات معلقة' : 'لا توجد بلاغات في هذه الفئة'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onAction={handleAction}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: '#1e293b', border: '1px solid #334155',
              color: page === 1 ? '#334155' : '#94a3b8',
              borderRadius: '8px', padding: '0.5rem 1rem',
              cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
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
                  borderRadius: '8px', padding: '0.5rem 0.75rem',
                  cursor: 'pointer', fontSize: '0.875rem',
                  fontWeight: page === p ? 700 : 400, minWidth: '36px',
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
              borderRadius: '8px', padding: '0.5rem 1rem',
              cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
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

export default function ReportsPage() {
  return (
    <AdminShell>
      <ReportsContent />
    </AdminShell>
  );
}
