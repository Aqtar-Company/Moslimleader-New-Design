'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { TAREEQ_CATEGORIES, CATEGORY_ICONS } from '@/lib/tareeq-constants';
import type { TareeqCategoryKey } from '@/lib/tareeq-constants';
import { compressImage } from '@/lib/compress-image';

const CATEGORY_KEYS = Object.keys(TAREEQ_CATEGORIES) as TareeqCategoryKey[];

const DRAFT_KEY = 'tareeq_draft';
const QUEUE_KEY = 'tareeq-post-queue';
interface Draft {
  content: string;
  category: string;
  savedAt: number;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
}

interface Props {
  onClose: () => void;
  onCreated: (id?: string) => void;
  initialContent?: string;
  initialFile?: File;
  mode?: 'text' | 'media';
}

export default function TareeqCreateModal({ onClose, onCreated, initialContent, initialFile, mode = 'text' }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState(initialContent ?? '');
  const [category, setCategory] = useState<TareeqCategoryKey | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [extraImages, setExtraImages] = useState<{ id: string; previewUrl: string; url: string | null; progress: number; failed?: boolean }[]>([]);
  const extraFileInputRef = useRef<HTMLInputElement>(null);
  // Track all object URLs for cleanup on unmount
  const localPreviewRef = useRef<string | null>(null);
  const extraPreviewUrlsRef = useRef<string[]>([]);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [showSeriesInput, setShowSeriesInput] = useState(false);
  const [draftBanner, setDraftBanner] = useState<Draft | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const catPickerRef = useRef<HTMLDivElement>(null);
  const uploadedForFile = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<{ content: string; category: string; imageUrl: string | null; imageUrls: string[] | null }>({ content: '', category: '', imageUrl: null, imageUrls: null });

  useEffect(() => {
    setMounted(true);
    if (mode !== 'media') {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
    // Restore draft only when no initialContent was explicitly provided
    if (initialContent == null) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d: Draft = JSON.parse(raw);
          if (d.content?.trim() || d.imageUrl) setDraftBanner(d);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialFile || uploadedForFile.current === initialFile) return;
    uploadedForFile.current = initialFile;
    setLocalPreview(null);
    setMediaUrl(null);
    setMediaType(null);
    setUploadProgress(0);
    if (initialFile.type.startsWith('image/')) {
      setLocalPreview(URL.createObjectURL(initialFile));
    }
    doUpload(initialFile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

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

  // Keep refs in sync for cleanup and immediate save on unmount
  useEffect(() => {
    const extraUrls = extraImages.filter(e => e.url).map(e => e.url!);
    const allUrls = mediaType === 'image' && mediaUrl ? [mediaUrl, ...extraUrls] : null;
    latestDraftRef.current = { content, category, imageUrl: mediaType === 'image' ? mediaUrl : null, imageUrls: allUrls };
  }, [content, category, mediaUrl, mediaType, extraImages]);

  useEffect(() => { localPreviewRef.current = localPreview; }, [localPreview]);
  useEffect(() => { extraPreviewUrlsRef.current = extraImages.map(e => e.previewUrl); }, [extraImages]);

  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const { content: c, category: cat, imageUrl: imgUrl, imageUrls: imgUrls } = latestDraftRef.current;
      if (c.trim() || cat || imgUrl) {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ content: c, category: cat, imageUrl: imgUrl, imageUrls: imgUrls, savedAt: Date.now() }));
          setDraftSaved(true);
          setTimeout(() => setDraftSaved(false), 2000);
        } catch { /* storage full or blocked */ }
      }
    }, 1500);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [content, category, mediaUrl, mediaType, extraImages]);

  // On unmount: revoke all object URLs + save draft immediately
  useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
      extraPreviewUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      const { content: c, category: cat, imageUrl: imgUrl, imageUrls: imgUrls } = latestDraftRef.current;
      if (c.trim() || imgUrl) {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ content: c, category: cat, imageUrl: imgUrl, imageUrls: imgUrls, savedAt: Date.now() })); } catch { /* ignore */ }
      }
    };
  }, []);

  async function doUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const isImage = file.type.startsWith('image/');
      const uploadFile = isImage
        ? await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 })
        : file;
      const form = new FormData();
      form.append('file', uploadFile);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/tareeq/upload');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              setMediaUrl(data.url);
              setMediaType(data.type);
              setUploadProgress(100);
              resolve();
            } else {
              setError(data.error || (isRtl ? 'فشل رفع الملف' : 'Upload failed'));
              reject();
            }
          } catch { setError(isRtl ? 'فشل رفع الملف' : 'Upload failed'); reject(); }
        };
        xhr.onerror = () => { setError(isRtl ? 'فشل رفع الملف' : 'Upload failed'); reject(); };
        xhr.send(form);
      });
    } catch { /* error set above */ }
    finally { setUploading(false); }
  }

  async function handleMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke existing preview before creating a new one
    if (localPreviewRef.current) { URL.revokeObjectURL(localPreviewRef.current); }
    setLocalPreview(null);
    setMediaUrl(null);
    setMediaType(null);
    setUploadProgress(0);
    setExtraImages([]);
    if (file.type.startsWith('image/')) {
      setLocalPreview(URL.createObjectURL(file));
    }
    await doUpload(file);
    e.target.value = '';
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 260) + 'px';
  }

  function removeMedia() {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    // If extras exist, promote the first completed one as the new main image
    const firstDone = extraImages.find(e => e.url !== null && !e.failed);
    if (firstDone) {
      setMediaUrl(firstDone.url);
      setMediaType('image');
      setLocalPreview(null);
      setUploadProgress(100);
      URL.revokeObjectURL(firstDone.previewUrl);
      setExtraImages(prev => prev.filter(x => x.id !== firstDone.id));
      return;
    }
    // No usable extra: clear everything
    extraPreviewUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    setMediaUrl(null);
    setMediaType(null);
    setLocalPreview(null);
    setUploadProgress(0);
    setExtraImages([]);
  }

  async function handleExtraImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    // Allow up to 9 total (main + extras)
    const slots = 9 - 1 - extraImages.length; // 9 max minus main image slot
    const toAdd = files.slice(0, Math.max(0, slots));
    if (!toAdd.length) return;

    const newItems = toAdd.map(f => ({
      id: Math.random().toString(36).slice(2),
      previewUrl: URL.createObjectURL(f),
      url: null as string | null,
      progress: 0,
    }));
    setExtraImages(prev => [...prev, ...newItems]);

    for (let i = 0; i < toAdd.length; i++) {
      const file = toAdd[i];
      const item = newItems[i];
      try {
        const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 });
        const form = new FormData();
        form.append('file', compressed);
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/tareeq/upload');
          xhr.withCredentials = true;
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100);
              setExtraImages(prev => prev.map(x => x.id === item.id ? { ...x, progress: pct } : x));
            }
          };
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) {
                setExtraImages(prev => prev.map(x => x.id === item.id ? { ...x, url: data.url, progress: 100 } : x));
                resolve();
              } else { reject(); }
            } catch { reject(); }
          };
          xhr.onerror = () => reject();
          xhr.send(form);
        });
      } catch {
        setExtraImages(prev => prev.map(x => x.id === item.id ? { ...x, failed: true, progress: 0 } : x));
      }
    }
  }

  function removeExtraImage(id: string) {
    const item = extraImages.find(x => x.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setExtraImages(prev => prev.filter(x => x.id !== id));
  }

  async function submit() {
    if (!mediaUrl && !content.trim()) {
      setError(isRtl ? 'اكتب شيئاً أو أضف صورة' : 'Write something or add a photo');
      return;
    }
    // Clear draft timer before network call to prevent race with onClose
    if (draftTimerRef.current) { clearTimeout(draftTimerRef.current); draftTimerRef.current = null; }
    setLoading(true);
    setError('');
    try {
      const extraUrls = extraImages.map(e => e.url).filter(Boolean) as string[];
      const allImageUrls = mediaType === 'image' && mediaUrl
        ? [mediaUrl, ...extraUrls]
        : null;
      const res = await fetch('/api/tareeq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: content.trim(),
          category: category || null,
          imageUrl: mediaType === 'image' ? mediaUrl : null,
          videoUrl: mediaType === 'video' ? mediaUrl : null,
          imageUrls: allImageUrls,
          seriesTitle: seriesTitle.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        onCreated(data.id);
        onClose();
      } else setError(data.error || (isRtl ? 'حدث خطأ' : 'An error occurred'));
    } catch {
      // Network failure — queue for retry when back online
      try {
        const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
        q.push({
          id: Math.random().toString(36).slice(2),
          content: content.trim(),
          category: category || null,
          imageUrl: mediaType === 'image' ? mediaUrl : null,
          videoUrl: mediaType === 'video' ? mediaUrl : null,
          imageUrls: mediaType === 'image' && mediaUrl ? [mediaUrl, ...extraImages.map(e => e.url).filter(Boolean)] : null,
          queuedAt: Date.now(),
        });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
        // Also clear draft so the queued content doesn't surface as a restore banner
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        window.dispatchEvent(new Event('tareeq-queue-changed'));
        onClose();
        return;
      } catch { /* ignore */ }
      setError(isRtl ? 'خطأ في الاتصال' : 'Connection error');
    } finally {
      setLoading(false);
    }
  }

  const extraUploading = extraImages.some(e => e.url === null);
  const canPublish = !loading && !uploading && !extraUploading && !!(mediaUrl || content.trim());
  const catObj = category ? TAREEQ_CATEGORIES[category] : null;
  const charCount = content.length;
  const charLeft = 5000 - charCount;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg sm:mx-4 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{
          maxHeight: '95dvh',
          background: 'var(--tr-surface)',
          border: '1px solid var(--tr-border-soft)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 24px 80px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Header ── */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--tr-border-subtle)' }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition"
            style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title + draft-saved flash */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-black text-sm" style={{ color: 'var(--tr-text-primary)' }}>
              {mode === 'media'
                ? (isRtl ? '🖼 صورة / فيديو' : '🖼 Photo / Video')
                : (isRtl ? '★ اترك علامة' : '★ Leave a Mark')}
            </span>
            {draftSaved && (
              <span className="text-[10px] font-semibold" style={{ color: 'var(--tr-gold)', opacity: 0.8 }}>
                {isRtl ? '✓ تم حفظ المسودة' : '✓ Draft saved'}
              </span>
            )}
          </div>

          {/* Publish */}
          <button
            onClick={submit}
            disabled={!canPublish}
            className="font-black px-5 py-2 rounded-full text-sm transition active:scale-95 disabled:opacity-40"
            style={{
              background: canPublish
                ? 'linear-gradient(135deg, var(--tr-gold-dim), var(--tr-gold-bright))'
                : 'var(--tr-overlay)',
              color: canPublish ? '#fff' : 'var(--tr-text-muted)',
              boxShadow: canPublish ? '0 2px 12px var(--tr-gold-glow)' : 'none',
            }}
          >
            {loading
              ? <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  {isRtl ? 'جاري النشر...' : 'Publishing...'}
                </span>
              : extraUploading
              ? <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  {isRtl ? 'جاري الرفع...' : 'Uploading...'}
                </span>
              : (isRtl ? 'انشر' : 'Publish')
            }
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div
            className="shrink-0 px-4 py-2 flex items-center gap-2 text-xs font-semibold"
            style={{ background: 'rgba(248,113,113,0.12)', borderBottom: '1px solid rgba(248,113,113,0.20)', color: '#f87171' }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Draft restore banner (sticky, always visible) ── */}
        {draftBanner && (
          <div
            className="shrink-0 flex items-center gap-2 px-4 py-2.5"
            style={{ background: 'rgba(212,168,83,0.1)', borderBottom: '1px solid rgba(212,168,83,0.25)' }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-gold)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            <span className="flex-1 min-w-0 text-xs font-semibold" style={{ color: 'var(--tr-gold)' }}>
              <span>
                {isRtl ? 'مسودة محفوظة' : 'Saved draft'}
                {draftBanner.savedAt ? (
                  <span className="font-normal" style={{ opacity: 0.7 }}>
                    {' · '}{(() => {
                      const diff = Math.floor((Date.now() - draftBanner.savedAt) / 1000);
                      if (diff < 60) return isRtl ? 'الآن' : 'just now';
                      if (diff < 3600) return isRtl ? `منذ ${Math.floor(diff/60)} د` : `${Math.floor(diff/60)}m ago`;
                      if (diff < 86400) return isRtl ? `منذ ${Math.floor(diff/3600)} س` : `${Math.floor(diff/3600)}h ago`;
                      return isRtl ? `منذ ${Math.floor(diff/86400)} ي` : `${Math.floor(diff/86400)}d ago`;
                    })()}
                  </span>
                ) : null}
              </span>
              {draftBanner.content && (
                <span className="block truncate font-normal mt-0.5" style={{ color: 'var(--tr-text-muted)', fontSize: 10 }}>
                  {draftBanner.content.slice(0, 60)}
                </span>
              )}
            </span>
            <button
              onClick={() => {
                setContent(draftBanner.content);
                if (draftBanner.category) setCategory(draftBanner.category as TareeqCategoryKey);
                // Restore media if saved in draft — only allow relative or same-origin URLs
                const isSafeUrl = (u: string) => u.startsWith('/') || u.startsWith(window.location.origin);
                if (draftBanner.imageUrl && isSafeUrl(draftBanner.imageUrl)) {
                  setMediaUrl(draftBanner.imageUrl);
                  setMediaType('image');
                  if (draftBanner.imageUrls && draftBanner.imageUrls.length > 1) {
                    setExtraImages(draftBanner.imageUrls.slice(1).filter(isSafeUrl).map(url => ({
                      id: Math.random().toString(36).slice(2),
                      previewUrl: url,
                      url,
                      progress: 100,
                    })));
                  }
                }
                setDraftBanner(null);
                try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="text-xs font-bold px-2.5 py-1 rounded-lg transition"
              style={{ background: 'var(--tr-gold)', color: '#fff' }}
            >
              {isRtl ? 'استكمال' : 'Restore'}
            </button>
            <button
              onClick={() => {
                setDraftBanner(null);
                try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
              }}
              className="text-xs px-2 py-1 rounded-lg transition"
              style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}
            >
              {isRtl ? 'تجاهل' : 'Discard'}
            </button>
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Compose: avatar + textarea */}
          <div className="flex gap-3 px-4 pt-4 pb-3">
            {/* Avatar */}
            <div className="shrink-0">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name ?? ''} className="w-10 h-10 rounded-full object-cover" style={{ boxShadow: '0 0 0 2px var(--tr-gold-dim)' }} />
                : <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base" style={{ background: 'var(--tr-overlay)', color: 'var(--tr-gold)', boxShadow: '0 0 0 2px var(--tr-gold-dim)' }}>
                    {user?.name?.charAt(0) ?? '?'}
                  </div>
              }
            </div>

            {/* Name + Textarea */}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm font-bold mb-2" style={{ color: 'var(--tr-text-primary)' }}>{user?.name}</p>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => { setContent(e.target.value); autoResize(); if (error) setError(''); }}
                placeholder={mode === 'media'
                  ? (isRtl ? 'أضف وصفاً أو تعليقاً (اختياري)...' : 'Add a caption (optional)...')
                  : (isRtl ? 'شارك تجربتك أو فكرتك أو سؤالك...' : 'Share your experience, idea, or question...')}
                maxLength={5000}
                rows={4}
                className="w-full text-sm outline-none resize-none bg-transparent leading-relaxed"
                style={{ minHeight: 120, color: 'var(--tr-text-secondary)' }}
                dir="auto"
              />
            </div>
          </div>

          {/* ── Media zone ── */}
          {(localPreview || mediaUrl || uploading) ? (
            <>
            {/* Active media preview */}
            <div className="mx-4 mb-4 relative rounded-2xl overflow-hidden" style={{ border: '1px solid var(--tr-border-soft)', minHeight: 180 }}>
              {/* Image or video */}
              {localPreview && mediaType !== 'video'
                ? <img src={localPreview} alt="" className="w-full max-h-72 object-cover" />
                : mediaUrl
                  ? mediaType === 'image'
                    ? <img src={mediaUrl} alt="" className="w-full max-h-72 object-cover" />
                    : <video src={mediaUrl} className="w-full max-h-72" controls playsInline />
                  : <div style={{ height: 180, background: 'var(--tr-overlay)' }} />
              }

              {/* Upload progress overlay */}
              {uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(0,0,0,0.60)' }}>
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                      <circle
                        cx="32" cy="32" r="27" fill="none"
                        stroke="var(--tr-gold-bright)" strokeWidth="5"
                        strokeDasharray={`${2 * Math.PI * 27}`}
                        strokeDashoffset={`${2 * Math.PI * 27 * (1 - uploadProgress / 100)}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.2s ease' }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-black text-sm" style={{ color: 'var(--tr-gold-bright)' }}>
                      {uploadProgress}%
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-white/80">
                    {isRtl ? 'جاري الرفع...' : 'Uploading...'}
                  </span>
                </div>
              )}

              {/* Controls when done */}
              {!uploading && (
                <>
                  {mediaUrl && (
                    <div className="absolute top-2 start-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold" style={{ background: 'rgba(16,185,129,0.88)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {isRtl ? 'تم الرفع' : 'Uploaded'}
                    </div>
                  )}
                  <button
                    onClick={removeMedia}
                    className="absolute top-2 end-2 w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold transition active:scale-90"
                    style={{ background: 'rgba(0,0,0,0.72)', color: '#fff' }}
                    aria-label={isRtl ? 'حذف الصورة' : 'Remove media'}
                  >×</button>
                </>
              )}
            </div>

            {/* ── Extra images strip (only when main is an image) ── */}
            {mediaType === 'image' && !uploading && (
              <div className="mx-4 mb-3" style={{ animation: 'tareeq-fadein 0.25s ease' }}>
                {/* Slot counter */}
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--tr-text-muted)' }}>
                    {isRtl
                      ? `${1 + extraImages.filter(e => !e.failed).length} / 9 صور`
                      : `${1 + extraImages.filter(e => !e.failed).length} / 9 photos`}
                  </span>
                  {extraImages.length >= 8 && (
                    <span className="text-[11px] font-semibold" style={{ color: '#f59e0b' }}>
                      {isRtl ? 'وصلت للحد الأقصى' : 'Max reached'}
                    </span>
                  )}
                </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {extraImages.map(ex => (
                  <div key={ex.id} className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0" style={{ border: `1px solid ${ex.failed ? 'rgba(248,113,113,0.6)' : 'var(--tr-border-soft)'}` }}>
                    <img src={ex.previewUrl} alt="" className="w-full h-full object-cover" />
                    {/* Uploading progress */}
                    {!ex.failed && ex.url === null && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                          <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                          <circle cx="16" cy="16" r="12" fill="none" stroke="var(--tr-gold-bright)" strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 12}`}
                            strokeDashoffset={`${2 * Math.PI * 12 * (1 - ex.progress / 100)}`}
                            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.2s ease' }} />
                        </svg>
                      </div>
                    )}
                    {/* Failed state */}
                    {ex.failed && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(239,68,68,0.82)' }}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <button
                          onClick={() => removeExtraImage(ex.id)}
                          className="text-white text-[10px] font-bold underline"
                        >{isRtl ? 'حذف' : 'Remove'}</button>
                      </div>
                    )}
                    {/* Uploaded — large enough × tap target */}
                    {!ex.failed && ex.url !== null && (
                      <button
                        onClick={() => removeExtraImage(ex.id)}
                        className="absolute top-0.5 end-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: 'rgba(0,0,0,0.72)', color: '#fff' }}
                        aria-label={isRtl ? 'حذف' : 'Remove'}
                      >×</button>
                    )}
                  </div>
                ))}
                {/* Add more button — matches active gold theme, max 9 total */}
                {extraImages.length < 8 && (
                  <label
                    className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer shrink-0 transition active:scale-95"
                    style={{ border: '1.5px solid var(--tr-gold-dim)', background: 'var(--tr-gold-glow)', color: 'var(--tr-gold)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tr-gold-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--tr-gold-bright)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--tr-gold-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--tr-gold)'; }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-[10px] font-bold">{isRtl ? 'إضافة' : 'Add'}</span>
                    <input
                      ref={extraFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={handleExtraImages}
                    />
                  </label>
                )}
              </div>
              </div>
            )}

            {/* ── Video: multi-image not available chip ── */}
            {mediaType === 'video' && !uploading && (
              <div className="mx-4 mb-3 flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--tr-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span className="text-[11px] font-medium" style={{ color: 'var(--tr-text-muted)' }}>
                  {isRtl ? 'تعدد الصور للصور فقط — الفيديو لا يدعمه' : 'Multi-photo is for images only'}
                </span>
              </div>
            )}
            </>
          ) : (
            /* Upload trigger area — tappable card */
            <label
              className="mx-4 mb-4 flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer transition"
              style={{
                height: mode === 'media' ? 148 : 90,
                border: mode === 'media' ? '2px solid var(--tr-gold-dim)' : '1.5px dashed var(--tr-border-soft)',
                background: mode === 'media' ? 'var(--tr-gold-glow)' : 'var(--tr-overlay)',
                color: mode === 'media' ? 'var(--tr-gold)' : 'var(--tr-text-muted)',
                boxShadow: mode === 'media' ? 'inset 0 0 0 3px var(--tr-gold-glow)' : 'none',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'var(--tr-gold-bright)';
                el.style.color = mode === 'media' ? 'var(--tr-gold-bright)' : 'var(--tr-gold)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = mode === 'media' ? 'var(--tr-gold-dim)' : 'var(--tr-border-soft)';
                el.style.color = mode === 'media' ? 'var(--tr-gold)' : 'var(--tr-text-muted)';
              }}
            >
              <svg className={mode === 'media' ? 'w-8 h-8' : 'w-6 h-6'} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 10.5h.008v.008H3V10.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM4.875 18h14.25a1.875 1.875 0 001.875-1.875V7.875A1.875 1.875 0 0019.125 6H4.875A1.875 1.875 0 003 7.875v8.25A1.875 1.875 0 004.875 18z" />
              </svg>
              <div className="flex flex-col items-center gap-1">
                <span className={`font-bold ${mode === 'media' ? 'text-sm' : 'text-xs'}`}>
                  {mode === 'media'
                    ? (isRtl ? 'اضغط لاختيار صورة أو فيديو' : 'Tap to select photo or video')
                    : (isRtl ? 'اضغط لإضافة صورة أو فيديو' : 'Tap to add photo or video')}
                </span>
                {mode === 'media' && (
                  <span className="text-[11px] font-medium" style={{ color: 'var(--tr-text-muted)' }}>
                    {isRtl ? 'JPG, PNG, GIF, MP4' : 'JPG, PNG, GIF, MP4'}
                  </span>
                )}
                {mode !== 'media' && (
                  <span className="text-[10px]" style={{ color: 'var(--tr-text-muted)', opacity: 0.75 }}>
                    {isRtl ? 'أو أضف حتى 9 صور معاً' : 'or add up to 9 photos'}
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={handleMedia}
              />
            </label>
          )}

          {/* ── Series row ── */}
          <div className="px-4 pb-3">
            {showSeriesInput ? (
              <div className="flex items-center gap-2 p-2.5 rounded-2xl" style={{ background: 'var(--tr-overlay)', border: '1px solid var(--tr-border-soft)' }}>
                <svg width={14} height={14} fill="none" stroke="var(--tr-gold)" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
                <input
                  value={seriesTitle}
                  onChange={e => setSeriesTitle(e.target.value)}
                  placeholder={isRtl ? 'اسم السلسلة...' : 'Series name...'}
                  maxLength={80}
                  className="flex-1 text-xs bg-transparent outline-none"
                  style={{ color: 'var(--tr-text-primary)' }}
                />
                <button onClick={() => { setShowSeriesInput(false); setSeriesTitle(''); }} style={{ color: 'var(--tr-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSeriesInput(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition"
                style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}
              >
                <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
                {isRtl ? 'إضافة لسلسلة' : 'Add to series'}
              </button>
            )}
          </div>

          {/* ── Category row ── */}
          <div className="px-4 pb-5" ref={catPickerRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCatPicker(v => !v)}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full border transition"
                style={category
                  ? { background: 'var(--tr-gold-glow)', color: 'var(--tr-gold-bright)', borderColor: 'var(--tr-gold-dim)' }
                  : { background: 'var(--tr-overlay)', color: 'var(--tr-text-secondary)', borderColor: 'var(--tr-border-soft)' }
                }
              >
                {category
                  ? <>{CATEGORY_ICONS[category]} {isRtl ? catObj?.ar : catObj?.en}</>
                  : <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                      </svg>
                      {isRtl ? 'اختر الفئة (اختياري)' : 'Category (optional)'}
                    </>
                }
                <svg className="w-3 h-3 opacity-50 ms-auto" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={showCatPicker ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
                </svg>
              </button>

              {showCatPicker && (
                <div
                  className="absolute bottom-full mb-2 start-0 z-20 p-2 grid grid-cols-3 gap-1 w-[210px] rounded-2xl"
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
          </div>
        </div>

        {/* ── Bottom toolbar ── */}
        <div
          className="shrink-0 flex items-center gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--tr-border-subtle)', background: 'var(--tr-surface)' }}
        >
          {/* Quick media button */}
          {!mediaUrl && !uploading && (
            <label
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full cursor-pointer transition"
              style={{ color: 'var(--tr-text-muted)', background: 'var(--tr-overlay)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-gold)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tr-text-muted)'; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <span>{isRtl ? 'صورة / فيديو' : 'Photo / Video'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={handleMedia}
              />
            </label>
          )}

          {uploading && (
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-full" style={{ color: 'var(--tr-gold)', background: 'var(--tr-gold-glow)' }}>
              <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              {isRtl ? `جاري الرفع ${uploadProgress}%` : `Uploading ${uploadProgress}%`}
            </div>
          )}

          {/* Char counter */}
          <div className="ms-auto flex items-center gap-2">
            {charCount > 0 && charLeft < 500 && (
              <span className="text-xs tabular-nums" style={{ color: charLeft < 50 ? '#ef4444' : charLeft < 200 ? '#f59e0b' : 'var(--tr-text-muted)' }}>
                {charLeft}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body,
  );
}
