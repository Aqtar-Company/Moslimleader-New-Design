'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';

/**
 * /admin/logo-designs — the designs offered at /logo for t-shirt printing, and that page's
 * banner. Files go to R2 through /api/admin/logo-designs/upload (the print file is kept as
 * uploaded; a PNG/JPG also gets a preview; a PDF needs a preview picture).
 */
type Design = {
  id: number; title: string; note: string | null; fileUrl: string; fileType: string; fileSize: number;
  width: number | null; height: number | null; previewUrl: string | null; sortOrder: number;
  isPublished: boolean; downloads: number;
};
type Banner = { imageUrl: string | null; title: string; subtitle: string };

const mb = (n: number) => (n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1);

async function upload(file: File, kind: 'design' | 'preview' | 'banner') {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', kind);
  const res = await adminFetch('/api/admin/logo-designs/upload', { method: 'POST', body: fd });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'فشل رفع الملف');
  return d;
}

export default function LogoDesignsAdmin() {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        adminFetch('/api/admin/logo-designs').then(r => r.json()),
        adminFetch('/api/admin/logo-designs/banner').then(r => r.json()),
      ]);
      setDesigns(a.designs ?? []);
      setBanner(b.banner ?? null);
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
    } finally { setLoading(false); }
  }, [addToast]);
  useEffect(() => { void load(); }, [load]);

  const patch = async (id: number, data: Partial<Design>) => {
    const res = await adminFetch(`/api/admin/logo-designs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { addToast(d.error || 'تعذّر الحفظ', 'error'); return false; }
    setDesigns(list => list.map(x => (x.id === id ? d.design : x)));
    return true;
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= designs.length) return;
    const a = designs[i], b = designs[j];
    const next = [...designs];
    next[i] = b; next[j] = a;
    setDesigns(next);
    // Give every row its position, so equal sortOrders cannot leave the order ambiguous.
    await Promise.all(next.map((d, idx) => (d.sortOrder !== idx ? patch(d.id, { sortOrder: idx }) : null)));
  };

  const remove = async (d: Design) => {
    const ok = await confirm({ title: 'حذف التصميم', message: `حذف «${d.title}» وملفاته؟`, confirmLabel: 'حذف', cancelLabel: 'تراجع', tone: 'danger', icon: '🗑️' });
    if (!ok) return;
    const res = await adminFetch(`/api/admin/logo-designs/${d.id}`, { method: 'DELETE' });
    if (!res.ok) { addToast('تعذّر الحذف', 'error'); return; }
    setDesigns(list => list.filter(x => x.id !== d.id));
    addToast('تم الحذف', 'success');
  };

  if (forbidden) return <ForbiddenState />;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#1a1a2e]">شعار مسلم ليدر للطباعة</h1>
          <p className="text-sm text-gray-500 mt-1">التصميمات اللي بتظهر في صفحة <a href="/logo" target="_blank" className="text-blue-600 underline">/logo</a> للتحميل وطباعة التيشرتات.</p>
        </div>
      </header>

      {loading ? <p className="text-gray-500">جارٍ التحميل…</p> : (
        <>
          {banner && <BannerEditor banner={banner} onSaved={setBanner} />}
          <NewDesign onCreated={d => setDesigns(list => [d, ...list])} />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#1a1a2e]">التصميمات ({designs.length})</h2>
            {designs.length === 0 && <p className="text-sm text-gray-500 bg-white rounded-xl p-5 border border-gray-100">لا توجد تصميمات بعد — أضف أول تصميم من الأعلى.</p>}
            <ul className="space-y-3">
              {designs.map((d, i) => (
                <DesignRow key={d.id} d={d} first={i === 0} last={i === designs.length - 1}
                  onMove={dir => move(i, dir)} onPatch={data => patch(d.id, data)} onDelete={() => remove(d)} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function BannerEditor({ banner, onSaved }: { banner: Banner; onSaved: (b: Banner) => void }) {
  const { addToast } = useToast();
  const [b, setB] = useState(banner);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { const { url } = await upload(f, 'banner'); setB(x => ({ ...x, imageUrl: url })); }
    catch (e) { addToast((e as Error).message, 'error'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const save = async () => {
    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/logo-designs/banner', { method: 'PUT', body: JSON.stringify(b) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'تعذّر الحفظ');
      onSaved(d.banner); setB(d.banner);
      addToast('تم حفظ البانر', 'success');
    } catch (e) { addToast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-3">
      <h2 className="text-lg font-bold text-[#1a1a2e]">البانر</h2>
      {/* Same as the page: the picture whole, the words under it. */}
      <div className="rounded-xl overflow-hidden bg-[#1a1a2e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {b.imageUrl && <img src={b.imageUrl} alt="" className="block w-full h-auto" />}
        <div className="p-4 text-white">
          <p className="font-black text-lg sm:text-2xl">{b.title || '—'}</p>
          {b.subtitle && <p className="text-xs sm:text-sm opacity-85">{b.subtitle}</p>}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">العنوان
          <input value={b.title} onChange={e => setB({ ...b, title: e.target.value })} maxLength={120} className="mt-1 w-full border rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm">السطر التحتي
          <input value={b.subtitle} onChange={e => setB({ ...b, subtitle: e.target.value })} maxLength={300} className="mt-1 w-full border rounded-lg px-3 py-2" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => pick(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg border text-sm font-bold disabled:opacity-50">{b.imageUrl ? 'تغيير صورة البانر' : 'رفع صورة البانر'}</button>
        {b.imageUrl && <button type="button" disabled={busy} onClick={() => setB({ ...b, imageUrl: null })} className="px-4 py-2 rounded-lg border text-sm text-red-600 disabled:opacity-50">إزالة الصورة</button>}
        <button type="button" disabled={busy} onClick={save} className="px-5 py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-bold disabled:opacity-50">{busy ? 'جارٍ…' : 'حفظ البانر'}</button>
      </div>
      <p className="text-xs text-gray-400">الصورة بتظهر كاملة بمقاسها، والعنوان والسطر تحتها. الأفضل صورة عريضة (مثلاً 1920×640) عشان ما تاخدش الشاشة كلها على الموبايل.</p>
    </section>
  );
}

function NewDesign({ onCreated }: { onCreated: (d: Design) => void }) {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevRef = useRef<HTMLInputElement>(null);
  const isPdf = !!file && /\.pdf$/i.test(file.name);

  const submit = async () => {
    if (!file) { addToast('اختر ملف التصميم', 'error'); return; }
    if (!title.trim()) { addToast('اكتب اسم التصميم', 'error'); return; }
    if (isPdf && !preview) { addToast('ملف PDF يحتاج صورة معاينة (PNG أو JPG)', 'error'); return; }
    setBusy(true);
    try {
      const up = await upload(file, 'design');
      let previewUrl = up.previewUrl as string | null;
      if (preview) previewUrl = (await upload(preview, 'preview')).url;
      const res = await adminFetch('/api/admin/logo-designs', { method: 'POST', body: JSON.stringify({ ...up, previewUrl, title, note, isPublished: true }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'تعذّر الحفظ');
      onCreated(d.design);
      setTitle(''); setNote(''); setFile(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      if (prevRef.current) prevRef.current.value = '';
      addToast('تمت إضافة التصميم', 'success');
    } catch (e) { addToast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-3">
      <h2 className="text-lg font-bold text-[#1a1a2e]">إضافة تصميم</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">اسم التصميم
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={190} placeholder="مثلاً: الشعار الذهبي — للخلفيات الغامقة" className="mt-1 w-full border rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm">ملاحظة للمطبعة (اختياري)
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={2000} placeholder="مثلاً: يُطبع على الصدر بعرض 25 سم" className="mt-1 w-full border rounded-lg px-3 py-2" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg border text-sm font-bold">{file ? `الملف: ${file.name} (${mb(file.size)} MB)` : 'اختر ملف الطباعة (PNG / SVG / PDF / JPG)'}</button>
        {isPdf && (
          <>
            <input ref={prevRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => setPreview(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => prevRef.current?.click()} className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-sm">{preview ? `المعاينة: ${preview.name}` : 'صورة معاينة للـ PDF'}</button>
          </>
        )}
        <button type="button" disabled={busy} onClick={submit} className="px-5 py-2 rounded-lg bg-[#F5C518] text-[#1a1a2e] text-sm font-black disabled:opacity-50">{busy ? 'جارٍ الرفع…' : 'إضافة'}</button>
      </div>
      <p className="text-xs text-gray-400">الأفضل للطباعة: PNG بخلفية شفافة وعرض 3000 بكسل أو أكثر، أو SVG. الملف بيتحفظ زي ما هو بدون ضغط. حد أقصى 40 MB.</p>
    </section>
  );
}

function DesignRow({ d, first, last, onMove, onPatch, onDelete }: {
  d: Design; first: boolean; last: boolean;
  onMove: (dir: -1 | 1) => void; onPatch: (data: Partial<Design>) => Promise<boolean>; onDelete: () => void;
}) {
  const [title, setTitle] = useState(d.title);
  const [note, setNote] = useState(d.note ?? '');
  const dirty = title !== d.title || note !== (d.note ?? '');
  return (
    <li className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
      <div className="w-full sm:w-32 aspect-square rounded-xl shrink-0 flex items-center justify-center p-2"
        style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 16px 16px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {d.previewUrl ? <img src={d.previewUrl} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-400">بدون معاينة</span>}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 font-bold" />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة للمطبعة" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
        <p className="text-xs text-gray-500" dir="ltr" style={{ textAlign: 'right' }}>
          {d.fileType.toUpperCase()} · {mb(d.fileSize)} MB{d.width && d.height ? ` · ${d.width}×${d.height}px` : ''} · {d.downloads} تحميل
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {dirty && <button type="button" onClick={() => onPatch({ title, note })} className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] text-white font-bold">حفظ</button>}
          <button type="button" onClick={() => onPatch({ isPublished: !d.isPublished })}
            className={`px-3 py-1.5 rounded-lg border font-bold ${d.isPublished ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500'}`}>
            {d.isPublished ? 'منشور' : 'مخفي'}
          </button>
          <button type="button" disabled={first} onClick={() => onMove(-1)} className="px-3 py-1.5 rounded-lg border disabled:opacity-30" aria-label="لأعلى">▲</button>
          <button type="button" disabled={last} onClick={() => onMove(1)} className="px-3 py-1.5 rounded-lg border disabled:opacity-30" aria-label="لأسفل">▼</button>
          <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg border">الملف</a>
          <button type="button" onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 ms-auto">حذف</button>
        </div>
      </div>
    </li>
  );
}
