'use client';

import { useEffect, useState } from 'react';
import { isDeployStaleError, tryDeployReload } from '@/lib/deploy-error';

/**
 * Two different screens, because these are two different situations.
 *
 * A deploy replaces every hashed JS chunk, so any tab that was already open throws the
 * moment it needs one. Nothing is broken and the user did nothing — the files moved thirty
 * seconds ago. Telling them "حدث خطأ غير متوقع" for that alarms someone whose only mistake
 * was having the tab open, and hides the one thing that fixes it.
 */
export default function ErrorBoundary({
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
    console.error('[ErrorBoundary]', error);
  }, [error, isDeploy]);

  if (isDeploy) return <UpdatingPanel reloading={reloading} />;

  return (
    <Shell>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
      <h2 style={{ color: '#1a1a1a', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
        حدث خطأ غير متوقع
      </h2>
      <p style={{ color: '#555', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
        نعتذر، حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => reset()} style={btnGold}>إعادة المحاولة</button>
        <button
          onClick={() => { if (typeof window !== 'undefined') window.location.href = '/'; }}
          style={btnDark}
        >
          الرجوع للرئيسية
        </button>
      </div>
    </Shell>
  );
}

const btnGold: React.CSSProperties = {
  background: '#F5C518', color: '#1a1a1a', border: 'none',
  padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700,
  cursor: 'pointer', fontSize: '1rem',
};

const btnDark: React.CSSProperties = {
  background: '#1a1a1a', color: '#fff', border: 'none',
  padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700,
  cursor: 'pointer', fontSize: '1rem',
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '1rem', fontFamily: 'Cairo, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '480px', background: '#ffffff', borderRadius: '16px',
          padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          textAlign: 'center', border: '1px solid #f0e0a0',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shared by both boundaries. Says what is happening, that it is brief, and that nothing
 * the user wrote is lost — which is the question someone actually has when a composer
 * disappears mid-sentence.
 */
export function UpdatingPanel({ reloading }: { reloading: boolean }) {
  return (
    <Shell>
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
      <button onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }} style={btnGold}>
        إعادة تحميل الصفحة
      </button>
    </Shell>
  );
}
