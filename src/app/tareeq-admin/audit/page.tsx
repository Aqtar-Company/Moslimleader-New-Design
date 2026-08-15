'use client';

import { useEffect, useState, useCallback } from 'react';
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

interface LogEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  admin: { id: string; name: string; email: string; role: string };
}

function actionColor(action: string): { bg: string; text: string } {
  if (action.includes('suspend') || action.includes('delete') || action.includes('ban'))
    return { bg: '#450a0a', text: '#fca5a5' };
  if (action.includes('hide')) return { bg: '#451a03', text: '#fcd34d' };
  if (action.includes('login')) return { bg: '#0c1a4d', text: '#93c5fd' };
  if (action.includes('feature')) return { bg: '#2e1065', text: '#c4b5fd' };
  if (action.includes('setting')) return { bg: '#451a03', text: '#fde68a' };
  if (action.includes('create') || action.includes('activate'))
    return { bg: '#052e16', text: '#86efac' };
  return { bg: C.border, text: C.muted };
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

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, act: string) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (act) params.set('action', act);
      const res = await fetch(`/api/tareeq-admin/audit?${params}`, { credentials: 'include' });
      if (res.status === 401) {
        router.push('/tareeq-admin/login');
        return;
      }
      const json = await res.json();
      setLogs(json.logs ?? []);
      setTotal(json.total ?? 0);
      setPages(json.pages ?? 1);
      setActions(json.actions ?? []);
      setLoading(false);
    },
    [router],
  );

  useEffect(() => {
    load(page, filterAction);
  }, [load, page, filterAction]);

  return (
    <AdminShell>
      <div dir="rtl" style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}
        >
          <div>
            <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: 0 }}>
              📋 سجل المراجعة
            </h1>
            <p style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
              {total} إجمالي السجلات
            </p>
          </div>
          {/* Filter */}
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(1);
            }}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.text,
              padding: '8px 14px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="">جميع العمليات</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div
          style={{
            background: C.surface,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  {['المشرف', 'العملية', 'النوع', 'الهدف', 'الـ IP', 'التاريخ', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        color: C.muted,
                        fontWeight: 600,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ color: C.muted, textAlign: 'center', padding: 40 }}>
                      جاري التحميل...
                    </td>
                  </tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ color: C.muted, textAlign: 'center', padding: 40 }}>
                      لا توجد سجلات
                    </td>
                  </tr>
                )}
                {logs.map((log) => {
                  const ac = actionColor(log.action);
                  const expanded = expandedId === log.id;
                  return [
                    <tr
                      key={log.id}
                      style={{
                        borderTop: `1px solid ${C.border}`,
                        cursor: log.details ? 'pointer' : 'default',
                      }}
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                    >
                      <td style={{ padding: '12px 16px', color: C.text }}>
                        <div style={{ fontWeight: 600 }}>{log.admin?.name}</div>
                        <div style={{ color: C.muted, fontSize: 11 }}>{log.admin?.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            background: ac.bg,
                            color: ac.text,
                            borderRadius: 999,
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: C.muted }}>
                        {log.targetType ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: C.muted,
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.targetId ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: C.muted }}>{log.ip ?? '—'}</td>
                      <td
                        style={{ padding: '12px 16px', color: C.muted, whiteSpace: 'nowrap' }}
                      >
                        {formatDate(log.createdAt)}
                      </td>
                      <td style={{ padding: '12px 16px', color: C.muted }}>
                        {log.details ? (
                          <span style={{ fontSize: 18 }}>{expanded ? '▲' : '▼'}</span>
                        ) : null}
                      </td>
                    </tr>,
                    expanded && log.details ? (
                      <tr key={`${log.id}-expanded`} style={{ background: '#0f172a' }}>
                        <td
                          colSpan={7}
                          style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}` }}
                        >
                          <pre
                            style={{
                              color: '#7dd3fc',
                              fontSize: 12,
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            }}
                          >
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              marginTop: 24,
            }}
          >
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: page <= 1 ? C.muted : C.text,
                padding: '8px 16px',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              السابق
            </button>
            <span style={{ color: C.muted, lineHeight: '38px', fontSize: 14 }}>
              {page} / {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: page >= pages ? C.muted : C.text,
                padding: '8px 16px',
                cursor: page >= pages ? 'not-allowed' : 'pointer',
              }}
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
