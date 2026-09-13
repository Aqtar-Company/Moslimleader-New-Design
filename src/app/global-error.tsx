'use client';

import { useEffect, useState } from 'react';
import { isDeployStaleError, tryDeployReload } from '@/lib/deploy-error';

/**
 * The last-resort boundary — it replaces `<html>`, so it cannot import the app's layout,
 * fonts or theme, and every style here is inline on purpose.
 *
 * Same split as `error.tsx`: a deploy that swapped the JS chunks out from under an open
 * tab is not an error, and must not be dressed as one. This is the boundary the user hit
 * during the last deploy, and it said "حدث خطأ غير متوقع".
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDeploy = isDeployStaleError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (isDeploy) {
      setReloading(tryDeployReload());
      return;
    }
    console.error('[GlobalError]', error);
  }, [error, isDeploy]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, background: '#FDF8EC', fontFamily: 'Cairo, Tahoma, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            style={{
              maxWidth: '480px', background: '#ffffff', borderRadius: '16px',
              padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
            }}
          >
            {isDeploy ? (
              <>
                <div
                  aria-hidden
                  style={{
                    width: 46, height: 46, margin: '0 auto 1rem',
                    border: '3px solid #f0e0a0', borderTopColor: '#F5C518',
                    borderRadius: '50%', animation: 'ml-spin 0.9s linear infinite',
                  }}
                />
                <style>{'@keyframes ml-spin{to{transform:rotate(360deg)}}'}</style>
                <h2 style={{ color: '#1a1a1a', margin: '0 0 0.75rem', fontSize: '1.4rem', fontWeight: 700 }}>
                  جاري رفع تحديثات الموقع
                </h2>
                <p style={{ color: '#555', margin: '0 0 1.5rem', lineHeight: 1.7 }}>
                  {reloading
                    ? 'نُحدّث النسخة الآن. ستُفتح الصفحة من جديد خلال ثوانٍ — لا داعي لعمل أي شيء.'
                    : 'التحديث ما زال جارياً. انتظر قليلاً ثم أعد تحميل الصفحة.'}
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
                <h2 style={{ color: '#1a1a1a', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
                  حدث خطأ غير متوقع
                </h2>
                <p style={{ color: '#555', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
                  نعتذر، حدث خطأ أثناء تحميل الصفحة. يرجى إعادة تحميل الصفحة.
                </p>
              </>
            )}

            <button
              onClick={() => {
                // `reset()` re-renders the same broken tree when the chunk is still
                // missing; a real reload is the only thing that fetches the new one.
                if (isDeploy && typeof window !== 'undefined') window.location.reload();
                else reset();
              }}
              style={{
                background: '#F5C518', color: '#1a1a1a', border: 'none',
                padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700,
                cursor: 'pointer', fontSize: '1rem',
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
