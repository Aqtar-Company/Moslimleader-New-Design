'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MEDIA_KINDS, KIND_LABEL, KIND_TO_TYPE, TYPE_TO_KIND, formatDuration, type MediaKind } from '@/lib/free-media-shared';
import {
  ACCEPT, kindOfFile, prepareAndUpload, titleFromFile, uploadCover, type UploadStage,
} from '@/lib/free-media-upload';
import { computeWaveform } from '@/lib/audio-waveform';
import Icon from '@/components/media/Icon';

/**
 * The media library's admin: one tab per KIND, each with its own categories and items.
 * What is published here appears at /media.
 *
 * Speed, because «الحفظ بياخد وقت» was the report:
 *  - A save merges the server's answer into the list; it no longer refetches everything.
 *  - Publish/unpublish is a one-field PATCH, not a full form PUT.
 *  - Old files are deleted on the server in the background, after the answer is sent.
 */

interface Category { id: number; kind: MediaKind; name: string; nameEn: string | null; sortOrder: number }
interface Item {
  id: number; title: string; titleEn: string | null; type: string; url: string; coverUrl: string | null;
  previewUrl: string | null; waveform: unknown; description: string | null; descriptionEn: string | null;
  sortOrder: number; isPublished: boolean; categoryId: number | null; durationSec: number | null;
  viewCount: number; downloadCount: number;
}
type Form = {
  title: string; titleEn: string; type: string; url: string; coverUrl: string; previewUrl: string;
  description: string; descriptionEn: string; sortOrder: number; isPublished: boolean;
  categoryId: number | null; durationSec: number | null; waveform?: number[] | null;
};

const emptyForm = (kind: MediaKind): Form => ({
  title: '', titleEn: '', type: KIND_TO_TYPE[kind], url: '', coverUrl: '', previewUrl: '', description: '', descriptionEn: '',
  sortOrder: 0, isPublished: false, categoryId: null, durationSec: null,
});

/** One file in the multi-upload queue. Category and publish are fixed WHEN ADDED. */
type QueueRow = { key: string; name: string; size: number; kind: MediaKind; stage: UploadStage; pct: number; note?: string; itemId?: number; file: File; categoryId: number | null; publish: boolean };

const STAGE_LABEL: Record<UploadStage, string> = {
  queued: 'في الانتظار', measuring: 'يقرأ الملف', compressing: 'يضغط', uploading: 'يرفع', finishing: 'يجهّز الغلاف', done: 'تم', error: 'فشل',
};

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;

async function json<T>(res: Response): Promise<T & { error?: string }> {
  return res.json().catch(() => ({} as T & { error?: string }));
}

export default function FreeMediaAdminPage() {
  const [kind, setKind] = useState<MediaKind>('video');
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCat, setFilterCat] = useState<number | 'all' | 'none'>('all');
  const [form, setForm] = useState<Form>(emptyForm('video'));
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileStage, setFileStage] = useState<{ stage: UploadStage; pct: number } | null>(null);
  const [coverPct, setCoverPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [bulkCat, setBulkCat] = useState<number | null>(null);
  const [bulkPublish, setBulkPublish] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const running = useRef(0);
  // The queue's source of truth. State is what renders; the ref is what the workers read,
  // so a worker finishing never acts on a stale copy and no side effect runs in an updater.
  const queueRef = useRef<QueueRow[]>([]);
  const commitQueue = (fn: (q: QueueRow[]) => QueueRow[]) => { queueRef.current = fn(queueRef.current); setQueue(queueRef.current); };

  useEffect(() => { void load(); }, []);

  async function load() {
    const res = await fetch('/api/admin/free-media');
    if (!res.ok) { setError('تعذّر تحميل الوسائط'); return; }
    const d = await res.json();
    setItems(d.items ?? []);
    setCategories(d.categories ?? []);
  }

  const upsertItem = (it: Item) => setItems(prev => (prev.some(p => p.id === it.id) ? prev.map(p => (p.id === it.id ? it : p)) : [it, ...prev]));

  const kindCats = useMemo(() => categories.filter(c => c.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id), [categories, kind]);
  const kindItems = useMemo(() => items.filter(i => TYPE_TO_KIND[i.type] === kind), [items, kind]);
  const countIn = (catId: number) => items.filter(i => i.categoryId === catId).length;
  const shown = kindItems.filter(i => filterCat === 'all' ? true : filterCat === 'none' ? !i.categoryId : i.categoryId === filterCat);
  const catName = (id: number | null) => categories.find(c => c.id === id)?.name ?? null;

  function switchKind(k: MediaKind) {
    setKind(k); setFilterCat('all'); setEditId(null); setForm(emptyForm(k)); setBulkCat(null);
    setError(''); setSuccess('');
  }

  function startEdit(item: Item) {
    setEditId(item.id);
    setForm({
      title: item.title, titleEn: item.titleEn ?? '', type: item.type, url: item.url, coverUrl: item.coverUrl ?? '',
      previewUrl: item.previewUrl ?? '', description: item.description ?? '', descriptionEn: item.descriptionEn ?? '',
      sortOrder: item.sortOrder, isPublished: item.isPublished, categoryId: item.categoryId, durationSec: item.durationSec,
    });
    setError(''); setSuccess('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── single item form ────────────────────────────────────────────────────────────
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const r = await prepareAndUpload(file, kind, (stage, pct) => setFileStage({ stage, pct }));
    setFileStage(null);
    if ('error' in r) { setError(r.error); return; }
    setForm(f => ({
      ...f,
      url: r.url,
      title: f.title || titleFromFile(file.name),
      durationSec: r.durationSec ?? f.durationSec,
      previewUrl: r.previewUrl ?? '',
      coverUrl: f.coverUrl || r.coverUrl || '',
      ...(r.waveform ? { waveform: r.waveform } : {}),
    }));
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCoverPct(0);
    const url = await uploadCover(file, setCoverPct);
    setCoverPct(null);
    if (url) setForm(f => ({ ...f, coverUrl: url }));
    else setError('تعذّر رفع الصورة المصغّرة');
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
      const d = await json<{ item: Item }>(res);
      if (!res.ok || !d.item) { setError(d.error || 'خطأ'); return; }
      upsertItem(d.item);
      setSuccess(editId ? 'تم الحفظ' : 'تمت الإضافة');
      setEditId(null);
      setForm(emptyForm(kind));
    } catch { setError('لا يوجد اتصال'); }
    finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('حذف هذا العنصر وملفه نهائياً؟')) return;
    const prev = items;
    setItems(p => p.filter(i => i.id !== id));
    const res = await fetch(`/api/admin/free-media/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { setItems(prev); setError('تعذّر الحذف'); }
  }

  async function togglePublished(item: Item) {
    upsertItem({ ...item, isPublished: !item.isPublished });
    const res = await fetch(`/api/admin/free-media/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublished: !item.isPublished }),
    }).catch(() => null);
    if (!res?.ok) { upsertItem(item); setError('تعذّر التغيير'); }
  }

  // ── multi-file queue ────────────────────────────────────────────────────────────
  function addFiles(list: FileList | File[]) {
    const rows: QueueRow[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(list)) {
      const k = kindOfFile(f, kind);
      if (!k) { rejected.push(f.name); continue; }
      rows.push({
        key: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`, name: f.name, size: f.size, kind: k, stage: 'queued', pct: 0, file: f,
        // The batch's category applies only to files of the tab's own kind.
        categoryId: k === kind ? bulkCat : null,
        publish: bulkPublish,
      });
    }
    if (rejected.length) setError(`تجاهلنا ملفات غير مدعومة: ${rejected.join('، ')}`);
    commitQueue(q => [...q, ...rows]);
    pump();
  }

  const patchRow = (key: string, p: Partial<QueueRow>) => commitQueue(q => q.map(r => (r.key === key ? { ...r, ...p } : r)));

  /** Two at a time: one file compresses or uploads while the next is measured. */
  function pump() {
    const free = 2 - running.current;
    if (free <= 0) return;
    const next = queueRef.current.filter(r => r.stage === 'queued').slice(0, free);
    if (!next.length) return;
    commitQueue(q => q.map(r => (next.some(n => n.key === r.key) ? { ...r, stage: 'measuring' as UploadStage } : r)));
    for (const r of next) { running.current++; void processRow(r); }
  }

  async function processRow(row: QueueRow) {
    try {
      const r = await prepareAndUpload(row.file, row.kind, (stage, pct, note) => patchRow(row.key, { stage, pct, note }));
      if ('error' in r) { patchRow(row.key, { stage: 'error', note: r.error }); return; }
      const res = await fetch('/api/admin/free-media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleFromFile(row.name), type: KIND_TO_TYPE[row.kind], url: r.url, coverUrl: r.coverUrl ?? '',
          previewUrl: r.previewUrl ?? '', durationSec: r.durationSec, waveform: r.waveform ?? undefined,
          categoryId: row.categoryId, isPublished: row.publish, sortOrder: 0,
        }),
      });
      const d = await json<{ item: Item }>(res);
      if (!res.ok || !d.item) { patchRow(row.key, { stage: 'error', note: d.error || 'تعذّر الحفظ' }); return; }
      upsertItem(d.item);
      patchRow(row.key, { stage: 'done', pct: 100, itemId: d.item.id, note: undefined });
    } catch {
      patchRow(row.key, { stage: 'error', note: 'خطأ غير متوقع' });
    } finally {
      running.current = Math.max(0, running.current - 1);
      pump();
    }
  }

  const retryRow = (key: string) => { patchRow(key, { stage: 'queued', pct: 0, note: undefined }); pump(); };

  // ── categories ──────────────────────────────────────────────────────────────────
  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    const res = await fetch('/api/admin/free-media/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name }),
    });
    const d = await json<{ category: Category }>(res);
    if (!res.ok || !d.category) { setError(d.error || 'تعذّر إضافة التصنيف'); return; }
    setNewCat('');
    setCategories(c => [...c, d.category]);
  }

  async function renameCategory() {
    if (!renaming || !renaming.name.trim()) return;
    const { id, name } = renaming;
    setCategories(c => c.map(x => (x.id === id ? { ...x, name: name.trim() } : x)));
    setRenaming(null);
    await fetch(`/api/admin/free-media/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  }

  async function deleteCategory(c: Category) {
    const n = countIn(c.id);
    if (!confirm(n ? `حذف التصنيف «${c.name}»؟ عناصره (${n}) تبقى بلا تصنيف ولا تُحذف.` : `حذف التصنيف «${c.name}»؟`)) return;
    setCategories(list => list.filter(x => x.id !== c.id));
    setItems(list => list.map(i => (i.categoryId === c.id ? { ...i, categoryId: null } : i)));
    if (filterCat === c.id) setFilterCat('all');
    await fetch(`/api/admin/free-media/categories/${c.id}`, { method: 'DELETE' });
  }

  async function moveCategory(c: Category, dir: -1 | 1) {
    const list = [...kindCats];
    const i = list.findIndex(x => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const order = new Map(list.map((x, idx) => [x.id, idx + 1]));
    setCategories(all => all.map(x => (order.has(x.id) ? { ...x, sortOrder: order.get(x.id)! } : x)));
    await Promise.all(list.map((x, idx) => fetch(`/api/admin/free-media/categories/${x.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: idx + 1 }),
    })));
  }

  // ── maintenance ─────────────────────────────────────────────────────────────────
  async function optimizeExisting() {
    if (!confirm('ضغط الصور الحالية: الصور المصغّرة الثقيلة تُستبدل بنسخ خفيفة، وكل رسمة تأخذ نسخة عرض خفيفة (الأصل يبقى للتحميل). يستمر حتى ينتهي — لا تغلق الصفحة.')) return;
    setError(''); setSuccess('');
    let afterId: number | null = 0;
    let changed = 0, saved = 0;
    try {
      while (afterId !== null) {
        const res: Response = await fetch('/api/admin/free-media/optimize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ afterId }),
        });
        const d = await json<{ nextAfterId: number | null; processed: number; total: number; changed: number; savedBytes: number }>(res);
        if (!res.ok) { setError(d.error || 'توقّف الضغط'); break; }
        changed += d.changed; saved += d.savedBytes;
        setBusy(`يضغط... ${d.processed} / ${d.total}`);
        afterId = d.nextAfterId;
      }
      setSuccess(`تم — حُدّث ${changed} عنصر، ووُفّر ${mb(saved)}`);
      await load();
    } finally { setBusy(null); }
  }

  async function measureWaveforms() {
    const todo = items.filter(i => TYPE_TO_KIND[i.type] === 'audio' && !Array.isArray(i.waveform));
    if (!todo.length) { setSuccess('كل الصوتيات لها موجات بالفعل'); return; }
    setError(''); setSuccess('');
    let ok = 0;
    try {
      for (let n = 0; n < todo.length; n++) {
        setBusy(`يقيس موجات الصوت... ${n + 1} / ${todo.length}`);
        // Read through our own origin (the download route — admins are not counted), so a
        // storage host without CORS does not matter.
        const res = await fetch(`/api/media/${todo[n].id}/download`).catch(() => null);
        if (!res?.ok) continue;
        const wf = await computeWaveform(await res.blob());
        if (!wf) continue;
        const p = await fetch(`/api/admin/free-media/${todo[n].id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waveform: wf }),
        }).catch(() => null);
        if (p?.ok) { ok++; upsertItem({ ...todo[n], waveform: wf }); }
      }
      setSuccess(`تم قياس ${ok} من ${todo.length}`);
    } finally { setBusy(null); }
  }

  async function notify() {
    if (!items.some(i => i.isPublished)) { setError('لا توجد وسائط منشورة لإرسالها'); return; }
    if (!confirm('سيتم إرسال إيميل لكل المستخدمين المسجّلين بعناوين حقيقية مفعّلة. متأكد؟')) return;
    setBusy('يرسل الإيميلات...'); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/admin/free-media/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await json<{ sent: number; failed: number }>(res);
      if (!res.ok) { setError(d.error || 'فشل الإرسال'); return; }
      setSuccess(`أُرسل إلى ${d.sent} مستخدم${d.failed ? ` (فشل: ${d.failed})` : ''}`);
    } catch { setError('فشل الاتصال بالسيرفر'); }
    finally { setBusy(null); }
  }

  const label = KIND_LABEL[kind];
  const fileWord = kind === 'audio' ? 'ملف صوتي' : kind === 'video' ? 'فيديو' : kind === 'reel' ? 'فيديو رأسي (ريل)' : kind === 'pdf' ? 'PDF' : 'صورة الرسمة';
  const activeQueue = queue.filter(r => r.stage !== 'done').length;
  const btn = 'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition disabled:opacity-50';

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Icon name="video" size={26} /> مكتبة الوسائط</h1>
        <div className="flex gap-2 flex-wrap">
          <a href="/media" target="_blank" rel="noopener" className={`${btn} bg-white hover:bg-gray-50`}><Icon name="external" size={15} /> الصفحة العامة</a>
          <button onClick={optimizeExisting} disabled={!!busy} className={`${btn} bg-white hover:bg-gray-50`}><Icon name="zap" size={15} /> ضغط الصور الحالية</button>
          <button onClick={measureWaveforms} disabled={!!busy} className={`${btn} bg-white hover:bg-gray-50`}><Icon name="audio" size={15} /> قياس موجات الصوتيات</button>
          <button onClick={notify} disabled={!!busy} className={`${btn} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}><Icon name="mail" size={15} /> إشعار المستخدمين</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">المنشور هنا يظهر في <span dir="ltr">moslimleader.com/media</span> — المشاهدة والاستماع للجميع، والتحميل بعد تسجيل الدخول.</p>
      {busy && <p className="mb-4 flex items-center gap-2 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2"><Icon name="loader" size={16} spin /> {busy}</p>}
      {error && <p className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><Icon name="alert" size={16} className="mt-0.5" /> {error}</p>}
      {success && <p className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2"><Icon name="check" size={16} /> {success}</p>}

      {/* Kind tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {MEDIA_KINDS.map(k => {
          const n = items.filter(i => TYPE_TO_KIND[i.type] === k).length;
          return (
            <button key={k} onClick={() => switchKind(k)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border whitespace-nowrap ${kind === k ? 'bg-[#1a1a2e] text-[#F5C518] border-[#1a1a2e]' : 'bg-white text-gray-600 hover:border-gray-400'}`}>
              <Icon name={k} size={17} /> {KIND_LABEL[k].ar} <span className="opacity-60 text-xs">({n})</span>
            </button>
          );
        })}
      </div>

      {/* Categories of this kind */}
      <section className="bg-white border rounded-xl p-4 mb-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Icon name="tag" size={18} /> تصنيفات {label.ar}</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {kindCats.length === 0 && <span className="text-sm text-gray-400">لا تصنيفات بعد — أضف أول تصنيف (مثلاً: أناشيد، قصص قبل النوم).</span>}
          {kindCats.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-0.5 border rounded-full ps-3 pe-1 py-1 bg-gray-50 text-sm">
              {renaming?.id === c.id ? (
                <>
                  <input autoFocus value={renaming.name} onChange={e => setRenaming({ id: c.id, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') void renameCategory(); if (e.key === 'Escape') setRenaming(null); }}
                    className="border rounded px-2 py-0.5 text-sm w-32" />
                  <button onClick={renameCategory} className="p-1 text-green-600" aria-label="حفظ"><Icon name="check" size={16} /></button>
                  <button onClick={() => setRenaming(null)} className="p-1 text-gray-400" aria-label="إلغاء"><Icon name="close" size={16} /></button>
                </>
              ) : (
                <>
                  <span className="font-semibold me-1">{c.name}</span>
                  <span className="text-xs text-gray-400 me-1">({countIn(c.id)})</span>
                  <button onClick={() => moveCategory(c, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="تقديم" title="تقديم"><Icon name="forward" size={15} /></button>
                  <button onClick={() => moveCategory(c, 1)} disabled={idx === kindCats.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="تأخير" title="تأخير"><Icon name="back" size={15} /></button>
                  <button onClick={() => setRenaming({ id: c.id, name: c.name })} className="p-1 text-blue-500" aria-label="إعادة تسمية" title="إعادة تسمية"><Icon name="edit" size={15} /></button>
                  <button onClick={() => deleteCategory(c)} className="p-1 text-red-500" aria-label="حذف" title="حذف"><Icon name="trash" size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addCategory(); }}
            placeholder={kind === 'audio' ? 'تصنيف جديد — مثلاً: قصص قبل النوم' : 'اسم تصنيف جديد'}
            className="flex-1 border rounded-lg px-3 py-2 text-sm" maxLength={80} />
          <button onClick={addCategory} className="inline-flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700"><Icon name="tag" size={16} /> إضافة تصنيف</button>
        </div>
      </section>

      {/* Multi-file upload */}
      <section className="bg-white border rounded-xl p-4 mb-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-1 flex items-center gap-2"><Icon name="upload" size={18} /> رفع عدة ملفات معاً</h2>
        <p className="text-xs text-gray-500 mb-3">كل ملف يصير عنصراً، عنوانه اسم الملف (عدّله بعدها). يُرفع ملفان في نفس الوقت، ولكل ملف شريط تقدّم. الفيديو الأكبر من 40 ميجا يُضغط قبل الرفع.</p>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="text-sm flex items-center gap-2">
            التصنيف:
            <select value={bulkCat ?? ''} onChange={e => setBulkCat(e.target.value ? Number(e.target.value) : null)} className="border rounded-lg px-2 py-1.5 text-sm">
              <option value="">— بلا تصنيف —</option>
              {kindCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={bulkPublish} onChange={e => setBulkPublish(e.target.checked)} /> انشرها مباشرة
          </label>
        </div>
        <input ref={bulkRef} type="file" multiple accept={Object.values(ACCEPT).join(',')} className="hidden"
          onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
        <div
          onClick={() => bulkRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer text-sm transition ${dragOver ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500 hover:border-blue-400'}`}
        >
          <span className="inline-flex flex-col items-center gap-2">
            <Icon name="upload" size={28} />
            اسحب الملفات هنا أو اضغط للاختيار — يمكن اختيار أكثر من ملف
          </span>
        </div>

        {queue.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">{activeQueue ? `${activeQueue} قيد المعالجة` : 'انتهت كل الملفات'}</p>
              {!activeQueue && <button onClick={() => commitQueue(() => [])} className="text-xs text-gray-500 hover:text-gray-800">مسح القائمة</button>}
            </div>
            <ul className="space-y-2">
              {queue.map(r => (
                <li key={r.key} className="border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name={r.kind} size={16} className="text-gray-400" />
                    <span className="flex-1 min-w-0 truncate font-semibold" dir="auto">{r.name}</span>
                    <span className="text-xs text-gray-400 tabular-nums" dir="ltr">{mb(r.size)}</span>
                    <span className={`text-xs font-bold ${r.stage === 'error' ? 'text-red-600' : r.stage === 'done' ? 'text-green-600' : 'text-blue-600'}`}>
                      {STAGE_LABEL[r.stage]}{(r.stage === 'uploading' || r.stage === 'compressing') ? ` ${r.pct}%` : ''}
                    </span>
                    {r.stage === 'done' && r.itemId && (
                      <button onClick={() => { const it = items.find(i => i.id === r.itemId); if (it) { if (TYPE_TO_KIND[it.type] !== kind) switchKind(TYPE_TO_KIND[it.type]); startEdit(it); } }}
                        className="p-1 text-blue-600" aria-label="تعديل" title="تعديل"><Icon name="edit" size={15} /></button>
                    )}
                    {r.stage === 'error' && <button onClick={() => retryRow(r.key)} className="text-xs font-bold text-blue-600">إعادة</button>}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden" dir="ltr">
                    <div
                      className={`h-full rounded-full transition-all ${r.stage === 'error' ? 'bg-red-500' : r.stage === 'done' ? 'bg-green-500' : r.stage === 'compressing' ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${r.stage === 'done' ? 100 : r.stage === 'queued' ? 0 : r.stage === 'measuring' ? 4 : r.stage === 'finishing' ? 96 : r.pct}%` }}
                    />
                  </div>
                  {r.note && <p className={`text-xs mt-1 ${r.stage === 'error' ? 'text-red-600' : 'text-amber-700'}`}>{r.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Single item form */}
      <section ref={formRef} className="bg-white border rounded-xl p-5 mb-6 shadow-sm">
        <h2 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
          <Icon name={editId ? 'edit' : kind} size={18} /> {editId ? `تعديل: ${form.title}` : `إضافة عنصر واحد إلى ${label.ar}`}
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">العنوان (عربي) *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">العنوان (إنجليزي)</label>
            <input value={form.titleEn} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" />
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
          <div onClick={() => !fileStage && fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 text-sm text-gray-500">
            {fileStage ? (
              <div>
                <p className="mb-2">{STAGE_LABEL[fileStage.stage]}{(fileStage.stage === 'uploading' || fileStage.stage === 'compressing') ? ` ${fileStage.pct}%` : '...'}</p>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" dir="ltr"><div className="h-full bg-blue-500 transition-all" style={{ width: `${fileStage.pct}%` }} /></div>
              </div>
            ) : form.url ? (
              <span className="inline-flex items-center gap-1.5 text-green-600 font-medium"><Icon name="check" size={16} /> {form.url.split('/').pop()}{form.durationSec ? ` — ${formatDuration(form.durationSec)}` : ''} <span className="text-gray-400">(اضغط للاستبدال)</span></span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Icon name="upload" size={16} /> اضغط لاختيار {fileWord} ({ACCEPT[kind].replaceAll('.', '').replaceAll(',', '، ')})</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">صورة مصغّرة {(kind === 'video' || kind === 'reel') ? '(تُؤخذ تلقائياً من الفيديو، ويمكن استبدالها)' : kind === 'image' ? '(تُصنع تلقائياً من الرسمة)' : '(اختياري)'}</label>
          <input ref={coverRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={onCover} className="hidden" />
          <div onClick={() => coverPct === null && coverRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-300 text-sm text-gray-400">
            {coverPct !== null ? <span>جاري رفع الصورة... {coverPct}%</span> : form.coverUrl ? (
              <div className="flex items-center justify-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.coverUrl} alt="" className="w-24 aspect-video object-cover rounded" />
                <span className="text-green-600 font-medium">الصورة المصغّرة (اضغط للاستبدال)</span>
              </div>
            ) : <span className="inline-flex items-center gap-1.5"><Icon name="image" size={16} /> اضغط لاختيار صورة مصغّرة</span>}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">وصف (عربي)</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">وصف (إنجليزي)</label>
            <textarea value={form.descriptionEn} onChange={e => setForm(f => ({ ...f, descriptionEn: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" rows={3} />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm mb-4">
          <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
          منشور (يظهر في صفحة الوسائط)
        </label>

        <div className="flex gap-3">
          <button onClick={save} disabled={saving || !!fileStage || coverPct !== null}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Icon name="loader" size={16} spin /> : <Icon name="check" size={16} />}
            {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديل' : 'إضافة'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(emptyForm(kind)); }} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">إلغاء</button>}
        </div>
      </section>

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
            <div className="w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Icon name={kind} size={28} strokeWidth={1.5} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{item.isPublished ? 'منشور' : 'مخفي'}</span>
                {catName(item.categoryId) && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{catName(item.categoryId)}</span>}
                {formatDuration(item.durationSec) && <span className="text-xs text-gray-400" dir="ltr">{formatDuration(item.durationSec)}</span>}
              </div>
              <p className="font-bold text-gray-800 truncate">{item.title}</p>
              <p className="text-xs text-gray-400 flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><Icon name="eye" size={13} /> {item.viewCount}</span>
                <span className="inline-flex items-center gap-1"><Icon name="download" size={13} /> {item.downloadCount}</span>
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
              <a href={`/media/${item.id}`} target="_blank" rel="noopener" className={`${btn} hover:bg-gray-50`} title="عرض"><Icon name="external" size={14} /></a>
              <button onClick={() => togglePublished(item)} className={`${btn} ${item.isPublished ? 'text-gray-600 hover:bg-gray-50' : 'text-green-600 hover:bg-green-50'}`}>
                <Icon name={item.isPublished ? 'close' : 'check'} size={14} /> {item.isPublished ? 'إخفاء' : 'نشر'}
              </button>
              <button onClick={() => startEdit(item)} className={`${btn} hover:bg-blue-50 text-blue-600`}><Icon name="edit" size={14} /> تعديل</button>
              <button onClick={() => remove(item.id)} className={`${btn} hover:bg-red-50 text-red-600`} aria-label="حذف" title="حذف"><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="text-center py-12 text-gray-400 bg-white border rounded-xl">لا عناصر هنا بعد</div>}
      </div>
    </div>
  );
}
