'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const inp: React.CSSProperties = {
  width: '100%', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 8, padding: '0.75rem 1rem', color: '#f1f5f9',
  fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
  direction: 'ltr', textAlign: 'left',
};

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return; }
    if (password.length < 8) { setError('كلمة المرور قصيرة جداً (8 أحرف على الأقل)'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/tareeq-admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'حدث خطأ'); return; }
      setDone(true);
      setTimeout(() => router.push('/tareeq-admin/login'), 2500);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p style={{ color: '#f87171', textAlign: 'center' }}>رابط غير صحيح</p>;
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius: 16, marginBottom: '1rem', fontSize: 28 }}>🔐</div>
        <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
          {done ? 'تم تغيير كلمة المرور' : 'كلمة مرور جديدة'}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {done ? 'سيتم توجيهك لتسجيل الدخول...' : 'أدخل كلمة المرور الجديدة'}
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {done ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ color: '#4ade80', fontWeight: 600 }}>تم تغيير كلمة المرور بنجاح</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>كلمة المرور الجديدة</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="8 أحرف على الأقل" style={inp}
              onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
              onBlur={e => (e.currentTarget.style.borderColor = '#334155')} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>تأكيد كلمة المرور</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="أعد كتابة كلمة المرور" style={inp}
              onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
              onBlur={e => (e.currentTarget.style.borderColor = '#334155')} />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', background: loading ? '#92400e' : '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.85rem', fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#1e293b', borderRadius: 16, border: '1px solid #334155', padding: '2.5rem 2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <Suspense fallback={<div style={{ color: '#94a3b8', textAlign: 'center' }}>جاري التحميل...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
