'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/tareeq-admin/AdminShell';

type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
interface Ticket {
  id: string; subject: string; status: Status; createdAt: string;
  user: { id: string; name: string; email: string };
}

const TABS: { key: Status | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'الكل' }, { key: 'OPEN', label: 'مفتوح' },
  { key: 'IN_PROGRESS', label: 'قيد المعالجة' }, { key: 'RESOLVED', label: 'محلول' },
  { key: 'CLOSED', label: 'مغلق' },
];
const STATUS_STYLE: Record<Status, { bg: string; color: string; label: string }> = {
  OPEN:        { bg: '#1d4ed833', color: '#60a5fa', label: 'مفتوح' },
  IN_PROGRESS: { bg: '#d97706 33', color: '#fbbf24', label: 'قيد المعالجة' },
  RESOLVED:    { bg: '#16653433', color: '#4ade80', label: 'محلول' },
  CLOSED:      { bg: '#33415533', color: '#94a3b8', label: 'مغلق' },
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<Status | 'ALL'>('OPEN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = status === 'ALL' ? '' : `?status=${status}`;
    fetch(`/api/tareeq-admin/support${q}`, { credentials: 'include' })
      .then(r => r.json()).then(d => setTickets(d.tickets ?? [])).finally(() => setLoading(false));
  }, [status]);

  return (
    <AdminShell>
      <div style={{ padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 24 }}>تذاكر الدعم</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #334155', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setStatus(t.key as Status | 'ALL')}
              style={{ padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: status === t.key ? '#f59e0b' : '#94a3b8', borderBottom: status === t.key ? '2px solid #f59e0b' : '2px solid transparent', fontWeight: status === t.key ? 700 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>جاري التحميل…</div>
        ) : tickets.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>لا توجد تذاكر</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tickets.map(t => {
              const s = STATUS_STYLE[t.status];
              return (
                <div key={t.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{t.user.name} · {t.user.email}</div>
                  </div>
                  <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
                  <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toLocaleDateString('ar')}</div>
                  <Link href={`/tareeq-admin/support/${t.id}`} style={{ fontSize: 13, color: '#f59e0b', textDecoration: 'none', whiteSpace: 'nowrap' }}>فتح</Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
