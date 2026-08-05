'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';

const CATEGORIES_AR = ['تجربة', 'قصة', 'فكرة', 'سؤال', 'مشروع', 'تأمل'];
const CATEGORIES_EN = ['Experience', 'Story', 'Idea', 'Question', 'Project', 'Reflection'];

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

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const categories = isRtl ? CATEGORIES_AR : CATEGORIES_EN;

  async function submit() {
    if (content.trim().length < 10) {
      setError(isRtl ? 'اكتب أكثر (10 أحرف على الأقل)' : 'Write at least 10 characters');
      return;
    }
    setLoading(true); setError('');
    const tags = tagsInput.split(/[,،\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    const res = await fetch('/api/tareeq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: content.trim(), title: title.trim() || null, category: category || null, tags }),
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
            <h2 className="font-black text-gray-900 text-base">⭐ {isRtl ? 'اترك علامة' : 'Leave a Mark'}</h2>
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

          {/* Category */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-semibold">{isRtl ? 'نوع العلامة' : 'Category'}</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition font-semibold ${
                    category === cat
                      ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {cat}
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

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-gray-100">
          <button
            onClick={submit}
            disabled={loading || content.trim().length < 10}
            className="w-full bg-[#1a1a2e] hover:bg-gray-800 text-[#F5C518] font-black py-3.5 rounded-xl text-sm transition disabled:opacity-40"
          >
            {loading ? '...' : (isRtl ? '⭐ انشر علامتك' : '⭐ Publish Your Mark')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
