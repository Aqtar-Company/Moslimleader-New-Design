'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const inp: React.CSSProperties = {
  width: '100%', background: '#0f172a', border: '1px solid #334155',
  borderRadius: 8, padding: '0.75rem 1rem', color: '#f1f5f9',
  fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
  direction: 'ltr', textAlign: 'left',
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/tareeq-admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (r.status === 429) { setError('طلبات كثيرة، حاول بعد قليل'); return; }
      setSent(true);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#1e293b', borderRadius: 16, border: '1px solid #334155', padding: '2.5rem 2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius: 16, marginBottom: '1rem', fontSize: 28 }}>🔑</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>نسيت كلمة المرور</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {sent ? 'تم إرسال رابط الاستعادة' : 'أدخل بريدك وسنرسل رابط إعادة التعيين'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <p style={{ color: '#94a3b8', lineHeight: 1.7, marginBottom: 24 }}>
              تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.<br />
              تحقق من البريد الوارد وافتح الرابط خلال ساعة.
            </p>
            <button onClick={() => router.push('/tareeq-admin/login')} style={{ background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              العودة لتسجيل الدخول
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>البريد الإلكتروني</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="admin@example.com" style={inp}
                onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                onBlur={e => (e.currentTarget.style.borderColor = '#334155')}
              />
            </div>
            <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', background: loading ? '#92400e' : '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.85rem', fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
            </button>
            <button type="button" onClick={() => router.push('/tareeq-admin/login')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}>
              العودة لتسجيل الدخول
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
