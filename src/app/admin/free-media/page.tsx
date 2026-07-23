'use client';
import { useEffect, useRef, useState } from 'react';

interface FreeMediaItem {
  id: number;
  title: string;
  titleEn: string | null;
  type: string;
  url: string;
  coverUrl: string | null;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  isPublished: boolean;
}

const EMPTY: Omit<FreeMediaItem, 'id'> = {
  title: '', titleEn: '', type: 'mp3', url: '', coverUrl: '',
  description: '', descriptionEn: '', sortOrder: 0, isPublished: false,
};

const TYPE_LABELS: Record<string, string> = { mp3: '🎵 صوتي', image: '🖼️ صورة', pdf: '📄 PDF' };

export default function FreeMediaAdminPage() {
  const [items, setItems] = useState<FreeMediaItem[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/admin/free-media');
    if (res.ok) { const d = await res.json(); setItems(d.items); }
  }

  function startAdd() {
    setEditId(null);
    setForm({ ...EMPTY });
    setError('');
    setSuccess('');
  }

  function startEdit(item: FreeMediaItem) {
    setEditId(item.id);
    setForm({
      title: item.title, titleEn: item.titleEn || '', type: item.type,
      url: item.url, coverUrl: item.coverUrl || '',
      description: item.description || '', descriptionEn: item.descriptionEn || '',
      sortOrder: item.sortOrder, isPublished: item.isPublished,
    });
    setError('');
    setSuccess('');
  }

  async function uploadMainFile(file: File, type: string): Promise<string | null> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setUploading(false);
        setUploadProgress(0);
        try {
          const d = JSON.parse(xhr.responseText);
          if (d.url) resolve(d.url);
          else { setError(d.error || 'فشل الرفع'); resolve(null); }
        } catch { setError('فشل الرفع'); resolve(null); }
      };
      xhr.onerror = () => { setUploading(false); setError('فشل الاتصال'); resolve(null); };
      xhr.open('POST', '/api/admin/free-media/upload');
      setUploading(true);
      xhr.send(fd);
    });
  }

  async function uploadCoverFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'cover');
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setCoverProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setCoverUploading(false);
        setCoverProgress(0);
        try {
          const d = JSON.parse(xhr.responseText);
          if (d.url) resolve(d.url);
          else { setError(d.error || 'فشل الرفع'); resolve(null); }
        } catch { setError('فشل الرفع'); resolve(null); }
      };
      xhr.onerror = () => { setCoverUploading(false); setError('فشل الاتصال'); resolve(null); };
      xhr.open('POST', '/api/admin/free-media/upload');
      setCoverUploading(true);
      xhr.send(fd);
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadMainFile(file, form.type);
    if (url) setForm(f => ({ ...f, url }));
    e.target.value = '';
  }

  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadCoverFile(file);
    if (url) setForm(f => ({ ...f, coverUrl: url }));
    e.target.value = '';
  }

  async function handleSave() {
    if (!form.title || !form.type || !form.url) {
      setError('العنوان والنوع والملف مطلوبون'); return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editId ? `/api/admin/free-media/${editId}` : '/api/admin/free-media';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'خطأ'); return; }
      setSuccess(editId ? 'تم التحديث' : 'تمت الإضافة');
      setEditId(null);
      setForm({ ...EMPTY });
      await load();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا العنصر؟')) return;
    await fetch(`/api/admin/free-media/${id}`, { method: 'DELETE' });
    await load();
  }

  async function togglePublished(item: FreeMediaItem) {
    await fetch(`/api/admin/free-media/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, isPublished: !item.isPublished }),
    });
    await load();
  }

  const accept = form.type === 'mp3' ? '.mp3,.ogg,.wav,.m4a' : form.type === 'pdf' ? '.pdf' : '.jpg,.jpeg,.png,.webp';

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🎵 الوسائط المجانية</h1>
        <button onClick={startAdd} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700">
          + إضافة وسيط
        </button>
      </div>

      {/* Form */}
      <div className="bg-white border rounded-xl p-5 mb-6 shadow-sm">
        <h2 className="font-bold mb-4 text-gray-700">{editId ? 'تعديل' : 'إضافة جديد'}</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">العنوان (عربي) *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="مثال: أغنية رمضان" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">العنوان (إنجليزي)</label>
            <input value={form.titleEn ?? ''} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" placeholder="e.g. Ramadan Song" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">النوع *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, url: '' }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="mp3">🎵 ملف صوتي (MP3)</option>
              <option value="image">🖼️ صورة تلوين</option>
              <option value="pdf">📄 PDF</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الترتيب</label>
            <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {/* File upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">الملف *</label>
          <input ref={fileRef} type="file" accept={accept} onChange={handleFileSelect} className="hidden" />
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 text-sm text-gray-500">
            {form.url ? (
              <span className="text-green-600 font-medium">✓ تم رفع الملف: {form.url.split('/').pop()}</span>
            ) : uploading ? (
              <span>جاري الرفع... {uploadProgress}%</span>
            ) : (
              <span>اضغط لاختيار {form.type === 'mp3' ? 'ملف صوتي' : form.type === 'pdf' ? 'PDF' : 'صورة'}</span>
            )}
          </div>
        </div>

        {/* Cover upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">صورة مصغرة (اختياري)</label>
          <input ref={coverRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleCoverSelect} className="hidden" />
          <div onClick={() => coverRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-300 text-sm text-gray-400">
            {form.coverUrl ? (
              <div className="flex items-center justify-center gap-2">
                <img src={form.coverUrl} alt="" className="w-10 h-10 object-cover rounded" />
                <span className="text-green-600 font-medium">✓ تم رفع الصورة</span>
              </div>
            ) : coverUploading ? <span>جاري الرفع... {coverProgress}%</span> : <span>اضغط لاختيار صورة مصغرة</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">وصف (عربي)</label>
            <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">وصف (إنجليزي)</label>
            <textarea value={form.descriptionEn ?? ''} onChange={e => setForm(f => ({ ...f, descriptionEn: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" rows={2} />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
            منشور (يظهر للمستخدمين)
          </label>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-3">{success}</p>}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving || uploading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : editId ? 'تحديث' : 'إضافة'}
          </button>
          {editId && (
            <button onClick={startAdd} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                {[...(TYPE_LABELS[item.type] || '')][0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[item.type] || item.type}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {item.isPublished ? 'منشور' : 'مخفي'}
                </span>
              </div>
              <p className="font-bold text-gray-800 truncate">{item.title}</p>
              {item.description && <p className="text-xs text-gray-500 truncate">{item.description}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => togglePublished(item)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${item.isPublished ? 'text-gray-600 hover:bg-gray-50' : 'text-green-600 hover:bg-green-50'}`}>
                {item.isPublished ? 'إخفاء' : 'نشر'}
              </button>
              <button onClick={() => startEdit(item)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-blue-50 text-blue-600">
                تعديل
              </button>
              <button onClick={() => handleDelete(item.id)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-red-50 text-red-600">
                حذف
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white border rounded-xl">لا توجد وسائط بعد</div>
        )}
      </div>
    </div>
  );
}
