'use client';
import { useEffect, useState } from 'react';
import AdminShell, { useAdminContext } from '@/components/tareeq-admin/AdminShell';

type Role = 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT' | 'SECURITY';

interface Admin {
  id: string; name: string; email: string; role: Role;
  isActive: boolean; lastLoginAt: string | null; createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'مدير عام', MODERATOR: 'مشرف', SUPPORT: 'دعم', SECURITY: 'أمان',
};
const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: '#7c3aed', MODERATOR: '#2563eb', SUPPORT: '#16a34a', SECURITY: '#ea580c',
};

export default function AdminsPage() {
  const { admin: me } = useAdminContext();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MODERATOR' as Role });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/tareeq-admin/roles', { credentials: 'include' });
    if (r.ok) setAdmins(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, cur: boolean) => {
    if (id === me?.id) return;
    await fetch(`/api/tareeq-admin/roles/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !cur }),
    });
    load();
  };

  const createAdmin = async () => {
    setError(''); setSaving(true);
    const r = await fetch('/api/tareeq-admin/roles', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!r.ok) { const d = await r.json(); setError(d.error || 'خطأ'); return; }
    setShowModal(false); setForm({ name: '', email: '', password: '', role: 'MODERATOR' });
    load();
  };

  return (
    <AdminShell>
      <div style={{ padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>إدارة المشرفين</h1>
          <button onClick={() => setShowModal(true)} style={{ background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, cursor: 'pointer' }}>
            + إضافة مشرف
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>جاري التحميل…</div>
        ) : (
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  {['الاسم', 'البريد', 'الدور', 'الحالة', 'آخر دخول', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid #1e293b' }}>
                    <td style={{ padding: '14px 16px', color: '#f1f5f9', fontSize: 14 }}>{a.name}</td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>{a.email}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: ROLE_COLORS[a.role] + '22', color: ROLE_COLORS[a.role], border: `1px solid ${ROLE_COLORS[a.role]}44`, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                        {ROLE_LABELS[a.role]}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: a.isActive ? '#16653422' : '#7f1d1d22', color: a.isActive ? '#4ade80' : '#f87171', borderRadius: 99, padding: '2px 10px', fontSize: 12 }}>
                        {a.isActive ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b', fontSize: 12 }}>
                      {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('ar') : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {a.id !== me?.id && (
                        <button onClick={() => toggleActive(a.id, a.isActive)} style={{ fontSize: 12, color: a.isActive ? '#f87171' : '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>
                          {a.isActive ? 'إيقاف' : 'تفعيل'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, width: 420 }}>
              <h2 style={{ color: '#f1f5f9', marginBottom: 24, fontSize: 18, fontWeight: 700 }}>إضافة مشرف جديد</h2>
              {error && <div style={{ background: '#7f1d1d44', color: '#f87171', padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
              {[
                { label: 'الاسم', field: 'name', type: 'text' },
                { label: 'البريد الإلكتروني', field: 'email', type: 'email' },
                { label: 'كلمة المرور', field: 'password', type: 'password' },
              ].map(({ label, field, type }) => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>{label}</label>
                  <input type={type} value={(form as Record<string, string>)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>الدور</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14 }}>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={createAdmin} disabled={saving} style={{ flex: 1, background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '…' : 'إنشاء'}
                </button>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer' }}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
