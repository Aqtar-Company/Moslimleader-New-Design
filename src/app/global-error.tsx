'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = String(error?.message || '');
    const digest = String(error?.digest || '');

    const isStaleAction =
      msg.includes('Failed to find Server Action') ||
      msg.includes('Server Actions') ||
      /Server Action.*not.*found/i.test(msg) ||
      /NEXT_NOT_FOUND/.test(digest);

    if (isStaleAction && typeof window !== 'undefined') {
      try {
        const key = 'ml-stale-reload-ts';
        const last = Number(sessionStorage.getItem(key) || '0');
        const now = Date.now();
        if (now - last > 10_000) {
          sessionStorage.setItem(key, String(now));
          window.location.reload();
          return;
        }
      } catch {}
    }

    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'Cairo, sans-serif', margin: 0, padding: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff8e6',
            padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
            <h2 style={{ color: '#1a1a1a', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
              حدث خطأ غير متوقع
            </h2>
            <p style={{ color: '#555', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              نعتذر، حدث خطأ أثناء تحميل الصفحة. يرجى إعادة تحميل الصفحة.
            </p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              style={{
                background: '#F5C518',
                color: '#1a1a1a',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
