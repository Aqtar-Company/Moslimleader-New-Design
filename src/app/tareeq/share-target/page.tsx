'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';

// Receives shared content from the OS via the manifest share_target GET params.
// Stores it in sessionStorage so TareeqClient can pre-fill the create modal, then redirects.
export default function ShareTargetPage() {
  const params   = useSearchParams();
  const router   = useRouter();
  const { isRtl } = useLang();

  useEffect(() => {
    const title = params.get('title') ?? '';
    const text  = params.get('text')  ?? '';
    const url   = params.get('url')   ?? '';
    const combined = [title, text, url].filter(Boolean).join('\n').trim();
    if (combined) {
      try { sessionStorage.setItem('tareeq-share-prefill', combined); } catch { /* private mode */ }
    }
    router.replace('/tareeq?action=create');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--tr-base)' }}
    >
      <p className="text-sm" style={{ color: 'var(--tr-text-muted)' }}>
        {isRtl ? 'جارٍ تحضير المحتوى المشارك…' : 'Preparing shared content…'}
      </p>
    </div>
  );
}
