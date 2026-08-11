'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TareeqAdminLogin() {
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/tareeq-admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ في تسجيل الدخول');
        return;
      }
      if (data.needsSetup) {
        router.push('/tareeq-admin/setup-2fa');
        return;
      }
      if (data.requireTotp) {
        setStep('totp');
        return;
      }
      router.push('/tareeq-admin/dashboard');
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/tareeq-admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'رمز التحقق غير صحيح');
        return;
      }
      router.push('/tareeq-admin/dashboard');
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#1e293b',
          borderRadius: '16px',
          border: '1px solid #334155',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderRadius: '16px',
              marginBottom: '1rem',
              fontSize: '28px',
            }}
          >
            🛡️
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            لوحة تحكم طريق
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {step === 'credentials' ? 'قم بتسجيل الدخول للمتابعة' : 'أدخل رمز التحقق الثنائي'}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: '#f87171',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@example.com"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: '#f1f5f9',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                onBlur={e => (e.currentTarget.style.borderColor = '#334155')}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: '#f1f5f9',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                onBlur={e => (e.currentTarget.style.borderColor = '#334155')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                background: loading ? '#92400e' : '#f59e0b',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                padding: '0.85rem',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                textAlign: 'center',
                padding: '1rem',
                background: 'rgba(245,158,11,0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(245,158,11,0.2)',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ fontSize: '2rem' }}>🔐</span>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
                افتح تطبيق المصادقة واحصل على رمز التحقق المكوّن من 6 أرقام
              </p>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                رمز التحقق
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="000000"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: '#f1f5f9',
                  fontSize: '1.5rem',
                  letterSpacing: '0.5em',
                  outline: 'none',
                  boxSizing: 'border-box',
                  direction: 'ltr',
                  textAlign: 'center',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#f59e0b')}
                onBlur={e => (e.currentTarget.style.borderColor = '#334155')}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              style={{
                marginTop: '0.5rem',
                background: loading || totpCode.length !== 6 ? '#92400e' : '#f59e0b',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                padding: '0.85rem',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading || totpCode.length !== 6 ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'جارٍ التحقق...' : 'تأكيد'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('credentials'); setTotpCode(''); setError(''); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              العودة لتسجيل الدخول
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
