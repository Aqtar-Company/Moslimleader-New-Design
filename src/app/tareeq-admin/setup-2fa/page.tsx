'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Setup2FA() {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetch('/api/tareeq-admin/auth/totp/setup', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
          setSecret(data.secret || '');
        } else {
          setLoadError(data.error || 'تعذّر تحميل إعداد المصادقة الثنائية');
        }
      })
      .catch(() => setLoadError('تعذّر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/tareeq-admin/auth/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totpCode }),
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
      setSubmitting(false);
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
          maxWidth: '480px',
          background: '#1e293b',
          borderRadius: '16px',
          border: '1px solid #334155',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
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
            🔐
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            إعداد المصادقة الثنائية
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            امسح رمز QR بتطبيق المصادقة لتفعيل الحماية الإضافية
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid #334155',
                borderTopColor: '#f59e0b',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto',
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#94a3b8', marginTop: '1rem', fontSize: '0.875rem' }}>جارٍ التحميل...</p>
          </div>
        )}

        {loadError && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '1rem',
              color: '#f87171',
              textAlign: 'center',
            }}
          >
            {loadError}
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* Steps */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(245,158,11,0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245,158,11,0.15)',
                }}
              >
                <span style={{ color: '#f59e0b', fontWeight: 700, minWidth: '20px' }}>١</span>
                <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: 0 }}>
                  ثبّت تطبيق مصادقة مثل <strong style={{ color: '#f1f5f9' }}>Google Authenticator</strong> أو <strong style={{ color: '#f1f5f9' }}>Authy</strong>
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(245,158,11,0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245,158,11,0.15)',
                }}
              >
                <span style={{ color: '#f59e0b', fontWeight: 700, minWidth: '20px' }}>٢</span>
                <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: 0 }}>
                  امسح رمز QR أدناه بالتطبيق
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(245,158,11,0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245,158,11,0.15)',
                }}
              >
                <span style={{ color: '#f59e0b', fontWeight: 700, minWidth: '20px' }}>٣</span>
                <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: 0 }}>
                  أدخل الرمز المكوّن من 6 أرقام من التطبيق للتأكيد
                </p>
              </div>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '1.25rem',
                  background: '#ffffff',
                  borderRadius: '12px',
                  marginBottom: '1.25rem',
                  display: 'inline-block',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={qrDataUrl}
                  alt="QR Code للمصادقة الثنائية"
                  style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto' }}
                />
              </div>
            )}

            {/* Manual secret */}
            {secret && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  أو أدخل المفتاح السري يدويًا:
                </p>
                <div
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: '#f59e0b',
                    letterSpacing: '0.1em',
                    wordBreak: 'break-all',
                    direction: 'ltr',
                    textAlign: 'center',
                    userSelect: 'all',
                  }}
                >
                  {secret}
                </div>
              </div>
            )}

            {/* Confirm form */}
            {error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: '#f87171',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  رمز التحقق (6 أرقام)
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
                  autoFocus
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
                />
              </div>
              <button
                type="submit"
                disabled={submitting || totpCode.length !== 6}
                style={{
                  background: submitting || totpCode.length !== 6 ? '#92400e' : '#f59e0b',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: submitting || totpCode.length !== 6 ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'جارٍ التفعيل...' : 'تفعيل المصادقة الثنائية'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
