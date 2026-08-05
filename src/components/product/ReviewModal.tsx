'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/context/LanguageContext';

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

export default function ReviewModal({ productId, productName, onClose }: Props) {
  const { isRtl } = useLang();
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function submit() {
    if (comment.trim().length < 10) { setError(isRtl ? 'اكتب تجربتك (10 أحرف على الأقل)' : 'Please write at least 10 characters'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId, comment: comment.trim(), author: author.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { setDone(true); }
    else { setError(data.error || (isRtl ? 'حدث خطأ' : 'An error occurred')); }
  }

  if (!mounted) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4" onClick={onClose} role="presentation">
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isRtl ? 'أضف تجربتك' : 'Share Your Experience'}
      >
        {done ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-black text-gray-900 text-lg mb-2">{isRtl ? 'شكراً لمشاركتك!' : 'Thank you!'}</h3>
            <p className="text-sm text-gray-500 mb-6">{isRtl ? 'تجربتك ستظهر قريباً.' : 'Your experience will appear soon.'}</p>
            <button onClick={onClose} className="bg-[#1a1a2e] text-white font-bold px-8 py-3 rounded-xl text-sm">{isRtl ? 'إغلاق' : 'Close'}</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-gray-900 text-base">💬 {isRtl ? 'أضف تجربتك' : 'Share Your Experience'}</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label={isRtl ? 'إغلاق' : 'Close'}>×</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">{isRtl ? `تجربتك مع "${productName}"` : `Your experience with "${productName}"`}</p>
            <div className="space-y-3">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={isRtl ? 'احكي تجربتك مع المنتج...' : 'Tell us about your experience...'}
                rows={4}
                maxLength={1000}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <input
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder={isRtl ? 'اسمك (اختياري)' : 'Your name (optional)'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={submit}
                disabled={loading}
                className="w-full bg-[#1a1a2e] hover:bg-gray-800 text-[#F5C518] font-black py-3 rounded-xl text-sm transition disabled:opacity-50"
              >
                {loading ? '...' : (isRtl ? 'أرسل تجربتي' : 'Submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
