'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import { compressImage } from '@/lib/compress-image';

const CATEGORY_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];

interface Props { onClose: () => void; onCreated: (id?: string) => void; initialContent?: string; }

export default function TareeqCreateModal({ onClose, onCreated, initialContent }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState(initialContent ?? '');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TareeqCategoryKey | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const catPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target as Node)) setShowCatPicker(false);
    };
    if (showCatPicker) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showCatPicker]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 280) + 'px';
  }

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val) && tags.length < 10) setTags(prev => [...prev, val]);
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(prev => prev.slice(0, -1));
    }
  }

  async function handleMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const isImage = file.type.startsWith('image/');
      const uploadFile = isImage ? await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 }) : file;
      const form = new FormData();
      form.append('file', uploadFile);
      const res = await fetch('/api/tareeq/upload', { method: 'POST', credentials: 'include', body: form });
      const data = await res.json();
      if (res.ok) { setMediaUrl(data.url); setMediaType(data.type); }
      else setError(data.error || (isRtl ? 'فشل رفع الملف' : 'Upload failed'));
    } catch {
      setError(isRtl ? 'فشل رفع الملف' : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function submit() {
    if (content.trim().length < 10) {
      setError(isRtl ? 'اكتب أكثر (10 أحرف على الأقل)' : 'Write at least 10 characters');
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/tareeq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: content.trim(),
          title: title.trim() || null,
          category: category || null,
          tags,
          imageUrl: mediaType === 'image' ? mediaUrl : null,
          videoUrl: mediaType === 'video' ? mediaUrl : null,
        }),
      });
      const data = await res.json();
      if (res.ok) { onCreated(data.id); onClose(); }
      else setError(data.error || (isRtl ? 'حدث خطأ' : 'An error occurred'));
    } catch {
      setError(isRtl ? 'حدث خطأ في الاتصال' : 'Connection error');
    } finally {
      setLoading(false);
    }
  }

  const charCount = content.length;
  const charLimit = 5000;
  const charLeft = charLimit - charCount;
  const progress = charCount / charLimit;
  const circumference = 2 * Math.PI * 11;
  const catObj = category ? TAREEQ_CATEGORIES[category] : null;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ background: 'rgba(26,24,40,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{
          maxHeight: '92dvh',
          background: 'var(--tr-raised)',
          border: '1px solid var(--tr-border-soft)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition"
            style={{ color: 'var(--tr-text-muted)' }}
            aria-label="إغلاق"
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--tr-text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--tr-text-muted)')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--tr-gold)', fontSize: 16 }}>★</span>
            <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>{isRtl ? 'اترك علامة' : 'Leave a Mark'}</span>
          </div>
          <button
            onClick={submit}
            disabled={loading || charCount < 10}
            className="font-black px-5 py-2 rounded-full text-sm disabled:opacity-30 active:scale-95 transition flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold))',
              color: '#fff',
              boxShadow: loading || charCount < 10 ? 'none' : '0 0 14px var(--tr-gold-glow)',
            }}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
            {isRtl ? 'انشر' : 'Publish'}
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Compose area */}
          <div className="flex gap-3 px-5 pt-4 pb-2">
            <div className="shrink-0 mt-0.5">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover" style={{ boxShadow: '0 0 0 2px var(--tr-gold-dim)' }} />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base"
                  style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', boxShadow: '0 0 0 2px var(--tr-gold-dim)' }}
                >
                  {user?.name?.charAt(0) ?? '?'}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={isRtl ? 'عنوان (اختياري)' : 'Add a title (optional)'}
                maxLength={120}
                className="w-full text-sm font-bold outline-none bg-transparent"
                style={{ color: 'var(--tr-text-primary)' }}
              />
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => { setContent(e.target.value); autoResize(); }}
                placeholder={isRtl ? 'اكتب تجربتك لتساعد غيرك في طريقه...' : 'Share what guides others on their path...'}
                maxLength={charLimit}
                rows={4}
                className="w-full text-sm outline-none resize-none bg-transparent leading-relaxed"
                style={{ minHeight: 100, color: 'var(--tr-text-secondary)' }}
              />
            </div>
          </div>

          {/* Media preview */}
          {mediaUrl && (
            <div className="mx-5 mb-3 relative rounded-2xl overflow-hidden" style={{ border: '1px solid var(--tr-border-soft)' }}>
              {mediaType === 'image'
                ? <img src={mediaUrl} alt="" className="w-full max-h-60 object-cover" />
                : <video src={mediaUrl} className="w-full max-h-60" controls />}
              <button
                onClick={() => { setMediaUrl(null); setMediaType(null); }}
                className="absolute top-2 end-2 rounded-full w-7 h-7 flex items-center justify-center text-lg leading-none transition"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
              >×</button>
            </div>
          )}

          {/* Category + Tags */}
          <div className="px-5 pb-4 space-y-3 pt-3" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
            {/* Category picker */}
            <div className="relative" ref={catPickerRef}>
              <button
                type="button"
                onClick={() => setShowCatPicker(v => !v)}
                className="flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-full border transition"
                style={category
                  ? { background: 'var(--tr-gold-glow)', color: 'var(--tr-gold-bright)', borderColor: 'var(--tr-gold-dim)' }
                  : { background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', borderColor: 'var(--tr-border-soft)' }
                }
              >
                {category
                  ? <>{CATEGORY_ICONS[category]} {isRtl ? catObj?.ar : catObj?.en}</>
                  : <><svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg> {isRtl ? 'نوع العلامة' : 'Category'}</> }
                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={showCatPicker ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
                </svg>
              </button>

              {showCatPicker && (
                <div
                  className="absolute top-full mt-2 start-0 z-20 p-2 grid grid-cols-3 gap-1 w-[210px] rounded-2xl"
                  style={{ background: 'var(--tr-raised)', border: '1px solid var(--tr-border-soft)', boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}
                >
                  {CATEGORY_KEYS.map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setCategory(category === key ? '' : key); setShowCatPicker(false); }}
                      className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-bold transition"
                      style={category === key
                        ? { background: 'var(--tr-gold-glow)', color: 'var(--tr-gold-bright)' }
                        : { color: 'var(--tr-text-secondary)' }
                      }
                    >
                      <span className="text-xl">{CATEGORY_ICONS[key]}</span>
                      <span>{isRtl ? TAREEQ_CATEGORIES[key].ar : TAREEQ_CATEGORIES[key].en}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tags chips */}
            <div
              className="flex flex-wrap items-center gap-1.5 min-h-[40px] rounded-xl px-3 py-2 transition cursor-text"
              style={{ border: '1px solid var(--tr-border-soft)', background: 'var(--tr-overlay)' }}
              onClick={() => document.getElementById('tareeq-tag-input')?.focus()}
            >
              {tags.map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: 'var(--tr-teal-dim)', color: 'var(--tr-teal)', border: '1px solid var(--tr-teal)33' }}
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter(t => t !== tag))}
                    className="opacity-60 hover:opacity-100 transition leading-none ml-0.5"
                  >×</button>
                </span>
              ))}
              <input
                id="tareeq-tag-input"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                placeholder={tags.length ? '' : (isRtl ? 'أضف وسماً... (اضغط Enter)' : 'Add tags... (press Enter)')}
                className="flex-1 min-w-[100px] text-xs outline-none bg-transparent py-0.5"
                style={{ color: 'var(--tr-text-secondary)' }}
              />
            </div>
          </div>
        </div>

        {/* ── Footer toolbar ── */}
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderTop: '1px solid var(--tr-border-subtle)', background: 'var(--tr-surface)' }}>
          <label
            className={`flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-2 transition cursor-pointer ${mediaUrl ? 'cursor-not-allowed opacity-50' : ''}`}
            style={{ color: mediaUrl ? 'var(--tr-teal)' : 'var(--tr-text-muted)', background: mediaUrl ? 'var(--tr-teal-dim)' : 'transparent' }}
          >
            {uploading ? (
              <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 10.5h.008v.008H3V10.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM4.875 18h14.25a1.875 1.875 0 001.875-1.875V7.875A1.875 1.875 0 0019.125 6H4.875A1.875 1.875 0 003 7.875v8.25A1.875 1.875 0 004.875 18z" />
              </svg>
            )}
            <span>{uploading ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'صورة / فيديو' : 'Photo / Video')}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" disabled={uploading || !!mediaUrl} onChange={handleMedia} />
          </label>

          <div className="ms-auto flex items-center gap-2">
            {charCount > 0 && charLeft < 300 && (
              <span className="text-xs font-mono tabular-nums" style={{ color: charLeft < 20 ? '#ef4444' : charLeft < 100 ? '#f59e0b' : 'var(--tr-text-muted)' }}>
                {charLeft}
              </span>
            )}
            {charCount > 0 && (
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="2.5" />
                <circle
                  cx="14" cy="14" r="11" fill="none"
                  stroke={charLeft < 20 ? '#ef4444' : charLeft < 100 ? '#f59e0b' : 'var(--tr-gold)'}
                  strokeWidth="2.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>

        {error && <p className="px-5 pb-4 text-xs text-center" style={{ color: '#f87171' }}>{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
