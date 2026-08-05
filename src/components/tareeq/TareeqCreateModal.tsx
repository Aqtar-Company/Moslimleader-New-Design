'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { TAREEQ_CATEGORIES, CATEGORY_KEY } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';

const CATEGORY_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];

interface Props { onClose: () => void; onCreated: () => void; }

export default function TareeqCreateModal({ onClose, onCreated }: Props) {
  const { isRtl } = useLang();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/tareeq/upload', { method: 'POST', credentials: 'include', body: form });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      setMediaUrl(data.url);
      setMediaType(data.type);
    } else {
      setError(data.error || (isRtl ? 'فشل رفع الملف' : 'Upload failed'));
    }
    e.target.value = '';
  }

  async function submit() {
    if (content.trim().length < 10) {
      setError(isRtl ? 'اكتب أكثر (10 أحرف على الأقل)' : 'Write at least 10 characters');
      return;
    }
    setLoading(true); setError('');
    const tags = tagsInput.split(/[,،\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    // Send canonical key — API normalizes but we send key directly for safety
    const res = await fetch('/api/tareeq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        content: content.trim(), title: title.trim() || null, category: category || null, tags,
        imageUrl: mediaType === 'image' ? mediaUrl : null,
        videoUrl: mediaType === 'video' ? mediaUrl : null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      onCreated();
      onClose();
      router.push(`/tareeq/${data.id}`);
    } else {
      setError(data.error || (isRtl ? 'حدث خطأ' : 'An error occurred'));
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 px-0 sm:px-4" onClick={onClose} role="presentation">
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-900 text-base flex items-center gap-2">
            <img src="/tareeq-logo- circle.png" alt="" className="w-6 h-6" />
            {isRtl ? 'اترك علامة' : 'Leave a Mark'}
          </h2>
            <p className="text-xs text-gray-400 mt-0.5">{isRtl ? 'شارك تجربتك مع المجتمع' : 'Share your experience with the community'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="إغلاق">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={isRtl ? 'عنوان (اختياري)' : 'Title (optional)'}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 font-semibold"
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={isRtl ? 'احكِ تجربتك، فكرتك، أو قصتك...' : 'Share your experience, idea, or story...'}
            rows={6}
            maxLength={5000}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">{content.length} / 5000</span>
          </div>

          {/* Category — stores canonical English key */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-semibold">{isRtl ? 'نوع العلامة' : 'Category'}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(category === key ? '' : key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition font-semibold ${
                    category === key
                      ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <input
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            placeholder={isRtl ? 'الوسوم (مفصولة بفاصلة): صلاة، تربية' : 'Tags (comma separated): prayer, parenting'}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />

          {/* Media upload */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-semibold">{isRtl ? 'صورة أو فيديو (اختياري)' : 'Image or Video (optional)'}</p>
            {mediaUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                {mediaType === 'image' ? (
                  <img src={mediaUrl} alt="" className="w-full max-h-48 object-cover" />
                ) : (
                  <video src={mediaUrl} className="w-full max-h-48" controls />
                )}
                <button
                  type="button"
                  onClick={() => { setMediaUrl(null); setMediaType(null); }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/80 transition"
                  aria-label="إزالة الوسائط"
                >×</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-xl px-4 py-3 hover:border-emerald-400 transition">
                {uploading ? (
                  <span className="text-xs text-gray-500">{isRtl ? 'جاري الرفع...' : 'Uploading...'}</span>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-500">{isRtl ? 'أضف صورة أو فيديو' : 'Add image or video'}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleMedia}
                />
              </label>
            )}
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-gray-100">
          <button
            onClick={submit}
            disabled={loading || content.trim().length < 10}
            className="w-full bg-[#1a1a2e] hover:bg-gray-800 text-[#F5C518] font-black py-3.5 rounded-xl text-sm transition disabled:opacity-40"
          >
            {loading ? '...' : (isRtl ? 'انشر علامتك' : 'Publish Your Mark')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
