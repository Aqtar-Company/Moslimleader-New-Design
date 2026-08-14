'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/tareeq-admin/AdminShell';

type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
interface Ticket {
  id: string; subject: string; body: string; status: Status;
  assignedTo: string | null; resolution: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
  user: { id: string; name: string; email: string };
}

const STATUS_LABELS: Record<Status, string> = {
  OPEN: 'مفتوح', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'محلول', CLOSED: 'مغلق',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ status: 'OPEN' as Status, assignedTo: '', resolution: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/tareeq-admin/support/${id}`, { credentials: 'include' })
      .then(r => r.json()).then(d => {
        setTicket(d);
        setForm({ status: d.status, assignedTo: d.assignedTo ?? '', resolution: d.resolution ?? '', notes: d.notes ?? '' });
      }).finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true); setSaved(false);
    const r = await fetch(`/api/tareeq-admin/support/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  const input = (styles?: object) => ({
    width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
    padding: '8px 12px', color: '#f1f5f9', fontSize: 14, outline: 'none',
    boxSizing: 'border-box' as const, ...styles,
  });

  return (
    <AdminShell>
      <div style={{ padding: '32px 24px', maxWidth: 800 }}>
        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>جاري التحميل…</div>
        ) : !ticket ? (
          <div style={{ color: '#f87171', textAlign: 'center', padding: 60 }}>لم يتم العثور على التذكرة</div>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{ticket.subject}</h1>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>
              {ticket.user.name} · {ticket.user.email} · {new Date(ticket.createdAt).toLocaleDateString('ar')}
            </div>

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>رسالة المستخدم</div>
              <p style={{ color: '#f1f5f9', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{ticket.body}</p>
            </div>

            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>إجراء المشرف</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>الحالة</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))} style={input()}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>تعيين إلى</label>
                  <input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="اسم المشرف" style={input()} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>الحل</label>
                <textarea value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} rows={4} placeholder="اكتب الحل هنا…" style={input({ resize: 'vertical' })} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>ملاحظات داخلية</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="ملاحظات داخلية (لا يراها المستخدم)…" style={input({ resize: 'vertical' })} />
              </div>

              <button onClick={save} disabled={saving} style={{ background: saved ? '#16a34a' : '#f59e0b', color: saved ? '#fff' : '#0f172a', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                {saving ? 'جاري الحفظ…' : saved ? '✓ تم الحفظ' : 'حفظ التغييرات'}
              </button>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
