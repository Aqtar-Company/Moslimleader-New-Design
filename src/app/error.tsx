'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = String(error?.message || '');
    const digest = String(error?.digest || '');

    // Detect stale Server Action cache errors (happens after a new build
    // when existing browser tabs reference old Server Action IDs)
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
        // Prevent infinite reload loop (at most once per 10s)
        if (now - last > 10_000) {
          sessionStorage.setItem(key, String(now));
          // Hard reload to fetch fresh HTML + JS chunks
          window.location.reload();
          return;
        }
      } catch {}
    }

    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: 'Cairo, sans-serif',
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
          border: '1px solid #f0e0a0',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
        <h2 style={{ color: '#1a1a1a', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
          حدث خطأ غير متوقع
        </h2>
        <p style={{ color: '#555', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          نعتذر، حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
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
            إعادة المحاولة
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/';
            }}
            style={{
              background: '#1a1a1a',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            الرجوع للرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
