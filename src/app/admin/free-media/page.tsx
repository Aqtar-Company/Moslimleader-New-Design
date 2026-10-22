'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MEDIA_KINDS, KIND_LABEL, KIND_TO_TYPE, TYPE_TO_KIND, formatDuration, type MediaKind } from '@/lib/free-media-shared';
import { captureVideoFrames } from '@/lib/tareeq-video-frames';
import { dataUrlToBlob } from '@/lib/data-url';

/**
 * The media library's admin: one tab per KIND (videos, audio, drawings, PDFs), each with its
 * own categories — «أناشيد», «قصص قبل النوم»… — and its own items. What is published here
 * appears at /media, which replaced the «وسائط مجانية» tab in the customer's account.
 */

interface Category { id: number; kind: MediaKind; name: string; nameEn: string | null; sortOrder: number; _count?: { items: number } }
interface Item {
  id: number; title: string; titleEn: string | null; type: string; url: string; coverUrl: string | null;
  description: string | null; descriptionEn: string | null; sortOrder: number; isPublished: boolean;
  categoryId: number | null; durationSec: number | null; viewCount: number; downloadCount: number;
}
type Form = Omit<Item, 'id' | 'viewCount' | 'downloadCount'>;

const emptyForm = (kind: MediaKind): Form => ({
  title: '', titleEn: '', type: KIND_TO_TYPE[kind], url: '', coverUrl: '', description: '', descriptionEn: '',
  sortOrder: 0, isPublished: false, categoryId: null, durationSec: null,
});

const ACCEPT: Record<MediaKind, string> = {
  audio: '.mp3,.m4a,.ogg,.wav',
  video: '.mp4,.webm,.mov,.m4v',
  image: '.jpg,.jpeg,.png,.webp',
  pdf: '.pdf',
};

/** Reads how long an audio/video file runs, from the file itself, before it is uploaded. */
function readDuration(file: File, kind: MediaKind): Promise<number | null> {
  if (kind !== 'audio' && kind !== 'video') return Promise.resolve(null);
  return new Promise(resolve => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    const t = setTimeout(() => done(null), 15_000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => { clearTimeout(t); done(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : null); };
    el.onerror = () => { clearTimeout(t); done(null); };
    el.src = url;
  });
}

function upload(file: File | Blob, type: string, onProgress: (p: number) => void, name = 'file'): Promise<{ url?: string; error?: string }> {
  return new Promise(resolve => {
    const fd = new FormData();
    fd.append('file', file, file instanceof File ? file.name : name);
    fd.append('type', type);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        resolve(d.url ? { url: d.url } : { error: d.error || 'فشل الرفع' });
      } catch {
        // nginx answers 413 with an HTML page, not JSON — say what that means.
        resolve({ error: xhr.status === 413 ? 'الملف أكبر من الحد المسموح على السيرفر' : 'فشل الرفع' });
      }
    };
    xhr.onerror = () => resolve({ error: 'فشل الاتصال' });
    xhr.open('POST', '/api/admin/free-media/upload');
    xhr.send(fd);
  });
}

export default function FreeMediaAdminPage() {
  const [kind, setKind] = useState<MediaKind>('video');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCat, setFilterCat] = useState<number | 'all' | 'none'>('all');
  const [form, setForm] = useState<Form>(emptyForm('video'));
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileProgress, setFileProgress] = useState<number | null>(null);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    const res = await fetch('/api/admin/free-media');
    if (!res.ok) { setError('تعذّر تحميل الوسائط'); return; }
    const d = await res.json();
    setItems(d.items ?? []);
    setCategories(d.categories ?? []);
  }

  const kindCats = useMemo(() => categories.filter(c => c.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id), [categories, kind]);
  const kindItems = useMemo(() => items.filter(i => TYPE_TO_KIND[i.type] === kind), [items, kind]);
  const shown = kindItems.filter(i => filterCat === 'all' ? true : filterCat === 'none' ? !i.categoryId : i.categoryId === filterCat);
  const catName = (id: number | null) => categories.find(c => c.id === id)?.name ?? null;

  function switchKind(k: MediaKind) {
    setKind(k);
    setFilterCat('all');
    setEditId(null);
    setForm(emptyForm(k));
    setError(''); setSuccess('');
  }

  function startEdit(item: Item) {
    setEditId(item.id);
    setForm({
      title: item.title, titleEn: item.titleEn ?? '', type: item.type, url: item.url, coverUrl: item.coverUrl ?? '',
      description: item.description ?? '', descriptionEn: item.descriptionEn ?? '', sortOrder: item.sortOrder,
      isPublished: item.isPublished, categoryId: item.categoryId, durationSec: item.durationSec,
    });
    setError(''); setSuccess('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const duration = await readDuration(file, kind);
    setFileProgress(0);
    const r = await upload(file, form.type, setFileProgress);
    setFileProgress(null);
    if (!r.url) { setError(r.error ?? 'فشل الرفع'); return; }
    setForm(f => ({ ...f, url: r.url!, durationSec: duration ?? f.durationSec }));

    // A video with no cover gets one from its own picture, so the grid at /media never
    // shows a black tile. Replaceable by uploading a cover below.
    if (kind === 'video' && !form.coverUrl) {
      const local = URL.createObjectURL(file);
      const frames = await captureVideoFrames(local, 1).finally(() => URL.revokeObjectURL(local));
      if (frames[0]) {
        setCoverProgress(0);
        const c = await upload(dataUrlToBlob(frames[0]), 'cover', setCoverProgress, 'cover.jpg');
        setCoverProgress(null);
        if (c.url) setForm(f => (f.coverUrl ? f : { ...f, coverUrl: c.url! }));
      }
    }
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCoverProgress(0);
    const r = await upload(file, 'cover', setCoverProgress);
    setCoverProgress(null);
    if (r.url) setForm(f => ({ ...f, coverUrl: r.url! }));
    else setError(r.error ?? 'فشل الرفع');
  }

  async function save() {
    if (!form.title.trim() || !form.url) { setError('العنوان والملف مطلوبان'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch(editId ? `/api/admin/free-media/${editId}` : '/api/admin/free-media', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'خطأ'); return; }
      setSuccess(editId ? 'تم التحديث' : 'تمت الإضافة');
      setEditId(null);
      setForm(emptyForm(kind));
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('حذف هذا العنصر وملفه نهائياً؟')) return;
    await fetch(`/api/admin/free-media/${id}`, { method: 'DELETE' });
    await load();
  }

  async function togglePublished(item: Item) {
    const res = await fetch(`/api/admin/free-media/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, isPublished: !item.isPublished }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'تعذّر التغيير'); }
    await load();
  }

  // ── categories ──────────────────────────────────────────────────────────────────
  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    const res = await fetch('/api/admin/free-media/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || 'تعذّر إضافة التصنيف'); return; }
    setNewCat('');
    await load();
  }

  async function renameCategory() {
    if (!renaming || !renaming.name.trim()) return;
    await fetch(`/api/admin/free-media/categories/${renaming.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renaming.name }),
    });
    setRenaming(null);
    await load();
  }

  async function deleteCategory(c: Category) {
    const n = c._count?.items ?? 0;
    if (!confirm(n ? `حذف التصنيف «${c.name}»؟ عناصره (${n}) تبقى بلا تصنيف ولا تُحذف.` : `حذف التصنيف «${c.name}»؟`)) return;
    await fetch(`/api/admin/free-media/categories/${c.id}`, { method: 'DELETE' });
    if (filterCat === c.id) setFilterCat('all');
    await load();
  }

  /** Swap with the neighbour. Sort orders are rewritten 1..n so equal values cannot stall. */
  async function moveCategory(c: Category, dir: -1 | 1) {
    const list = [...kindCats];
    const i = list.findIndex(x => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((x, idx) => fetch(`/api/admin/free-media/categories/${x.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: idx + 1 }),
    })));
    await load();
  }

  async function notify() {
    if (!items.some(i => i.isPublished)) { setError('لا توجد وسائط منشورة لإرسالها'); return; }
    if (!confirm('سيتم إرسال إيميل لكل المستخدمين المسجّلين بعناوين حقيقية مفعّلة. متأكد؟')) return;
    setNotifying(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/admin/free-media/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'فشل الإرسال'); return; }
      setSuccess(`✓ أُرسل إلى ${d.sent} مستخدم${d.failed ? ` (فشل: ${d.failed})` : ''}`);
    } catch { setError('فشل الاتصال بالسيرفر'); }
    finally { setNotifying(false); }
  }

  const label = KIND_LABEL[kind];
  const fileWord = kind === 'audio' ? 'ملف صوتي' : kind === 'video' ? 'فيديو' : kind === 'pdf' ? 'PDF' : 'صورة الرسمة';

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">🎬 مكتبة الوسائط</h1>
        <div className="flex gap-2">
          <a href="/media" target="_blank" rel="noopener" className="border px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50">عرض الصفحة العامة ↗</a>
          <button onClick={notify} disabled={notifying} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {notifying ? 'جاري الإرسال...' : '📧 إشعار المستخدمين'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5">المنشور هنا يظهر في <span dir="ltr">moslimleader.com/media</span> — المشاهدة والاستماع للجميع، والتحميل بعد تسجيل الدخول.</p>

      {/* Kind tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {MEDIA_KINDS.map(k => {
          const n = items.filter(i => TYPE_TO_KIND[i.type] === k).length;
          return (
            <button key={k} onClick={() => switchKind(k)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border whitespace-nowrap ${kind === k ? 'bg-[#1a1a2e] text-[#F5C518] border-[#1a1a2e]' : 'bg-white text-gray-600 hover:border-gray-400'}`}>
              {KIND_LABEL[k].icon} {KIND_LABEL[k].ar} <span className="opacity-60 text-xs">({n})</span>
            </button>
          );
        })}
      </div>

      {/* Categories of this kind */}
      <div className="bg-white border rounded-xl p-4 mb-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-3">تصنيفات {label.ar}</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {kindCats.length === 0 && <span className="text-sm text-gray-400">لا تصنيفات بعد — أضف أول تصنيف (مثلاً: أناشيد، قصص قبل النوم).</span>}
          {kindCats.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-1 border rounded-full ps-3 pe-1 py-1 bg-gray-50 text-sm">
              {renaming?.id === c.id ? (
                <>
                  <input autoFocus value={renaming.name} onChange={e => setRenaming({ id: c.id, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') void renameCategory(); if (e.key === 'Escape') setRenaming(null); }}
                    className="border rounded px-2 py-0.5 text-sm w-32" />
                  <button onClick={renameCategory} className="text-green-600 px-1" title="حفظ">✓</button>
                  <button onClick={() => setRenaming(null)} className="text-gray-400 px-1" title="إلغاء">✕</button>
                </>
              ) : (
                <>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-gray-400">({c._count?.items ?? 0})</span>
                  <button onClick={() => moveCategory(c, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 px-1 disabled:opacity-30" title="تقديم">→</button>
                  <button onClick={() => moveCategory(c, 1)} disabled={idx === kindCats.length - 1} className="text-gray-400 hover:text-gray-700 px-1 disabled:opacity-30" title="تأخير">←</button>
                  <button onClick={() => setRenaming({ id: c.id, name: c.name })} className="text-blue-500 px-1" title="إعادة تسمية">✎</button>
                  <button onClick={() => deleteCategory(c)} className="text-red-500 px-1" title="حذف">🗑</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addCategory(); }}
            placeholder={kind === 'audio' ? 'تصنيف جديد — مثلاً: قصص قبل النوم' : 'اسم تصنيف جديد'}
            className="flex-1 border rounded-lg px-3 py-2 text-sm" maxLength={80} />
          <button onClick={addCategory} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700">+ إضافة تصنيف</button>
        </div>
      </div>

      {/* Form */}
      <div ref={formRef} className="bg-white border rounded-xl p-5 mb-6 shadow-sm">
        <h2 className="font-bold mb-4 text-gray-700">{editId ? `تعديل: ${form.title}` : `إضافة إلى ${label.ar}`}</h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">العنوان (عربي) *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">العنوان (إنجليزي)</label>
            <input value={form.titleEn ?? ''} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">التصنيف</label>
            <select value={form.categoryId ?? ''} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value ? Number(e.target.value) : null }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">— بلا تصنيف —</option>
              {kindCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الترتيب <span className="text-gray-400 font-normal text-xs">(الأصغر يظهر أولاً)</span></label>
            <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">الملف *</label>
          <input ref={fileRef} type="file" accept={ACCEPT[kind]} onChange={onFile} className="hidden" />
          <div onClick={() => fileProgress === null && fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 text-sm text-gray-500">
            {fileProgress !== null ? (
              <span>جاري الرفع... {fileProgress}%</span>
            ) : form.url ? (
              <span className="text-green-600 font-medium">✓ {form.url.split('/').pop()}{form.durationSec ? ` — ${formatDuration(form.durationSec)}` : ''} <span className="text-gray-400">(اضغط للاستبدال)</span></span>
            ) : (
              <span>اضغط لاختيار {fileWord} ({ACCEPT[kind].replaceAll('.', '').replaceAll(',', '، ')})</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">صورة مصغّرة {kind === 'video' ? '(تُؤخذ تلقائياً من الفيديو، ويمكن استبدالها)' : '(اختياري)'}</label>
          <input ref={coverRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={onCover} className="hidden" />
          <div onClick={() => coverProgress === null && coverRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-300 text-sm text-gray-400">
            {coverProgress !== null ? <span>جاري رفع الصورة... {coverProgress}%</span> : form.coverUrl ? (
              <div className="flex items-center justify-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.coverUrl} alt="" className="w-24 aspect-video object-cover rounded" />
                <span className="text-green-600 font-medium">✓ الصورة المصغّرة (اضغط للاستبدال)</span>
              </div>
            ) : <span>اضغط لاختيار صورة مصغّرة</span>}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">وصف (عربي)</label>
            <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">وصف (إنجليزي)</label>
            <textarea value={form.descriptionEn ?? ''} onChange={e => setForm(f => ({ ...f, descriptionEn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" rows={3} />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm mb-4">
          <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
          منشور (يظهر في صفحة الوسائط)
        </label>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-3">{success}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving || fileProgress !== null || coverProgress !== null}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : editId ? 'تحديث' : 'إضافة'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(emptyForm(kind)); }} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">إلغاء</button>}
        </div>
      </div>

      {/* Filter by category */}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        {([['all', 'الكل'], ['none', 'بلا تصنيف'], ...kindCats.map(c => [c.id, c.name] as const)] as const).map(([v, name]) => (
          <button key={String(v)} onClick={() => setFilterCat(v as number | 'all' | 'none')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${filterCat === v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600'}`}>
            {name}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {shown.map(item => (
          <div key={item.id} className="bg-white border rounded-xl p-3 flex items-center gap-4 shadow-sm">
            <div className="w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-2xl shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.coverUrl ? <img src={item.coverUrl} alt="" className="w-full h-full object-cover" /> : KIND_LABEL[kind].icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.isPublished ? 'منشور' : 'مخفي'}</span>
                {catName(item.categoryId) && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{catName(item.categoryId)}</span>}
                {formatDuration(item.durationSec) && <span className="text-xs text-gray-400" dir="ltr">{formatDuration(item.durationSec)}</span>}
              </div>
              <p className="font-bold text-gray-800 truncate">{item.title}</p>
              <p className="text-xs text-gray-400">👁 {item.viewCount} · ⬇️ {item.downloadCount}</p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <a href={`/media/${item.id}`} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50">عرض</a>
              <button onClick={() => togglePublished(item)} className={`text-xs px-3 py-1.5 rounded-lg border ${item.isPublished ? 'text-gray-600 hover:bg-gray-50' : 'text-green-600 hover:bg-green-50'}`}>
                {item.isPublished ? 'إخفاء' : 'نشر'}
              </button>
              <button onClick={() => startEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-blue-50 text-blue-600">تعديل</button>
              <button onClick={() => remove(item.id)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-red-50 text-red-600">حذف</button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="text-center py-12 text-gray-400 bg-white border rounded-xl">لا عناصر هنا بعد</div>}
      </div>
    </div>
  );
}
