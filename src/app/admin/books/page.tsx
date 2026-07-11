'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { formatAgeLabel } from '@/lib/book-age';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { adminFetch, adminJson, ForbiddenError } from '@/lib/admin-fetch';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface Book {
  id: string;
  title: string;
  titleEn?: string;
  language?: string;
  section?: string;
  description: string;
  cover: string;
  author?: string;
  category?: string;
  price: number;
  priceUSD?: number;
  freePages: number;
  totalPages: number;
  isPublished: boolean;
  allowQuoteShare: boolean;
  allowFriendShare: boolean;
  friendShareHours: number;
  enableReferral: boolean;
  referralDiscount: number;
  enableWatermark: boolean;
  enableForensic: boolean;
  minAge?: number | null;
  maxAge?: number | null;
  needsParentalGuide?: boolean;
  paperProductSlug?: string | null;
  bgmUrl?: string | null;
  promoVideoUrl?: string | null;
  _count: { accesses: number };
}

interface AccessEntry {
  user: { id: string; name: string; email: string };
  lastPage: number;
  grantedAt: string;
}

const emptyForm = {
  title: '',
  titleEn: '',
  language: 'ar',
  section: 'books',
  description: '',
  authorEn: '',
  descriptionEn: '',
  author: '',
  category: '',
  price: 0,
  priceUSD: 0,
  freePages: 10,
  totalPages: 0,
  isPublished: false,
  allowQuoteShare: true,
  allowFriendShare: false,
  friendShareHours: 24,
  enableReferral: false,
  referralDiscount: 10,
  enableWatermark: true,
  enableForensic: true,
  minAge: '' as number | '',
  maxAge: '' as number | '',
  needsParentalGuide: false,
  paperProductSlug: '',
  bgmUrl: '',
  promoVideoUrl: '',
};

export default function AdminBooksPage() {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [isOpenEnded, setIsOpenEnded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Tracks the book id currently being toggled/deleted so rapid clicks coalesce.
  const [mutatingBookId, setMutatingBookId] = useState<string | null>(null);

  // Upload
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedPdfPath, setUploadedPdfPath] = useState('');
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState('');
  const pdfRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadedBgmUrl, setUploadedBgmUrl] = useState('');

  // Access management
  const [accessBookId, setAccessBookId] = useState<string | null>(null);
  const [accesses, setAccesses] = useState<AccessEntry[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantMsg, setGrantMsg] = useState('');

  const loadBooks = () => {
    setLoading(true);
    adminFetch('/api/admin/books')
      .then(r => r.json())
      .then(d => { setBooks(d.books ?? []); setForbidden(false); })
      .catch(err => {
        if (err instanceof ForbiddenError) setForbidden(true);
        else addToast('فشل تحميل الكتب', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBooks(); }, []);

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.type === 'number' ? Number(target.value) : target.value;
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const openAdd = () => {
    setEditBook(null);
    setForm({ ...emptyForm });
    setIsOpenEnded(false);
    setUploadedPdfPath('');
    setUploadedCoverUrl('');
    setPdfFile(null);
    setCoverFile(null);
    setSaveError('');
    setShowForm(true);
  };

  const openEdit = (b: Book) => {
    setEditBook(b);
    setForm({
      title: b.title,
      titleEn: b.titleEn || '',
      language: (b as Book & { language?: string }).language || 'ar',
      section: (b as Book & { section?: string }).section || 'books',
      authorEn: (b as Book & { authorEn?: string }).authorEn || '',
      descriptionEn: (b as Book & { descriptionEn?: string }).descriptionEn || '',
      description: b.description,
      author: b.author || '',
      category: b.category || '',
      price: b.price,
      priceUSD: (b as Book & { priceUSD?: number }).priceUSD || 0,
      freePages: b.freePages,
      totalPages: b.totalPages,
      isPublished: b.isPublished,
      allowQuoteShare: b.allowQuoteShare,
      allowFriendShare: b.allowFriendShare,
      friendShareHours: b.friendShareHours,
      enableReferral: b.enableReferral,
      referralDiscount: b.referralDiscount,
      enableWatermark: b.enableWatermark,
      enableForensic: b.enableForensic,
      minAge: b.minAge ?? '',
      maxAge: b.maxAge ?? '',
      needsParentalGuide: b.needsParentalGuide ?? false,
      paperProductSlug: b.paperProductSlug || '',
      bgmUrl: b.bgmUrl || '',
      promoVideoUrl: b.promoVideoUrl || '',
    });
    setIsOpenEnded(b.minAge != null && b.maxAge == null);
    setUploadedPdfPath('');
    setUploadedCoverUrl(b.cover || '');
    setPdfFile(null);
    setCoverFile(null);
    setSaveError('');
    setShowForm(true);
  };

  const uploadFile = (file: File, type: 'pdf' | 'cover' | 'audio', isPdf = false): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/books/upload');
      xhr.withCredentials = true;
      if (isPdf) {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data.path as string);
          else reject(new Error(data.error || 'Upload failed'));
        } catch { reject(new Error('Upload failed')); }
      };
      xhr.onerror = () => reject(new Error('فشل الاتصال أثناء الرفع'));
      xhr.send(fd);
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setSaveError('العنوان مطلوب'); return; }
    setSaving(true);
    setSaveError('');
    try {
      let pdfPath = uploadedPdfPath;
      let coverUrl = uploadedCoverUrl;
      let bgmPath = uploadedBgmUrl;

      setUploading(true);
      setUploadProgress(0);
      if (pdfFile) pdfPath = await uploadFile(pdfFile, 'pdf', true);
      setUploadProgress(0);
      if (coverFile) coverUrl = await uploadFile(coverFile, 'cover');
      if (audioFile) bgmPath = await uploadFile(audioFile, 'audio');
      setUploading(false);

      const body = {
        ...form,
        minAge: form.minAge !== '' ? Number(form.minAge) : null,
        maxAge: !isOpenEnded && form.maxAge !== '' ? Number(form.maxAge) : null,
        ...(pdfPath ? { filePath: pdfPath } : {}),
        ...(coverUrl ? { cover: coverUrl } : {}),
        ...(bgmPath ? { bgmUrl: bgmPath } : {}),
      };

      const url = editBook ? `/api/admin/books/${editBook.id}` : '/api/admin/books';
      const method = editBook ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'خطأ'); return; }
      setShowForm(false);
      loadBooks();
    } catch (e) {
      setSaveError('خطأ في الرفع');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({
      title: 'حذف الكتاب',
      message: `حذف "${title}"؟ كل بيانات الوصول هتتشال.`,
      confirmLabel: 'حذف',
      cancelLabel: 'تراجع',
      tone: 'danger',
      icon: '🗑️',
    });
    if (!ok || mutatingBookId === id) return;
    setMutatingBookId(id);
    try {
      await adminJson(`/api/admin/books/${id}`, { method: 'DELETE' });
      addToast('تم حذف الكتاب', 'success');
      loadBooks();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الحذف', 'error');
    } finally {
      setMutatingBookId(null);
    }
  };

  const togglePublish = async (b: Book) => {
    if (mutatingBookId === b.id) return;
    setMutatingBookId(b.id);
    try {
      await adminJson(`/api/admin/books/${b.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isPublished: !b.isPublished }),
      });
      // Optimistic local update so the toggle flips instantly even
      // before loadBooks returns.
      setBooks(prev => prev.map(x => x.id === b.id ? { ...x, isPublished: !x.isPublished } : x));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل التحديث', 'error');
    } finally {
      setMutatingBookId(null);
    }
  };

  const openAccess = (bookId: string) => {
    setAccessBookId(bookId);
    setGrantEmail('');
    setGrantMsg('');
    setAccessLoading(true);
    adminFetch(`/api/admin/books/${bookId}/grant`)
      .then(r => r.json())
      .then(d => setAccesses(d.accesses ?? []))
      .catch(() => addToast('فشل تحميل قائمة الوصول', 'error'))
      .finally(() => setAccessLoading(false));
  };

  const handleGrant = async () => {
    if (!grantEmail.trim() || !accessBookId) return;
    if (grantLoading) return;
    setGrantLoading(true);
    setGrantMsg('');
    try {
      await adminJson(`/api/admin/books/${accessBookId}/grant`, {
        method: 'POST',
        body: JSON.stringify({ email: grantEmail.trim() }),
      });
      setGrantMsg('✓ تم منح الوصول');
      setGrantEmail('');
      openAccess(accessBookId);
    } catch (err) {
      setGrantMsg(err instanceof Error ? err.message : 'خطأ');
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!accessBookId) return;
    try {
      await adminJson(`/api/admin/books/${accessBookId}/grant`, {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });
      openAccess(accessBookId);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل إلغاء الوصول', 'error');
    }
  };

  const accessBook = books.find(b => b.id === accessBookId);

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-400 bg-white';
  const checkRow = (key: string, label: string) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={form[key as keyof typeof form] as boolean}
        onChange={f(key)}
        className="w-4 h-4 accent-amber-400"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );

  if (forbidden) return <ForbiddenState requiredPerm="books.read" />;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">📚 إدارة الكتب</h1>
          <p className="text-sm text-gray-400 mt-1">{books.length} كتاب</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black px-5 py-2.5 rounded-xl text-sm transition"
        >
          + إضافة كتاب
        </button>
      </div>

      {/* Books table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : books.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-semibold">لا توجد كتب بعد</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs">الكتاب</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs">السعر</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs">الصفحات الحرة</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs">القراء</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs">الحالة</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {books.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {b.cover ? (
                            <Image src={b.cover} alt={b.title} width={40} height={56} className="object-cover w-full h-full" unoptimized />
                          ) : (
                            <div className="flex items-center justify-center h-full text-xl">📖</div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{b.title}</p>
                          {b.author && <p className="text-xs text-gray-400">{b.author}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">
                      {b.price === 0 ? 'مجاني' : `${b.price.toLocaleString('en-US')} ج.م`}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{b.freePages} صفحة</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openAccess(b.id)}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        {b._count.accesses} قارئ
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => togglePublish(b)}
                        disabled={mutatingBookId === b.id}
                        className={`text-xs font-bold px-3 py-1 rounded-full transition disabled:opacity-50 ${
                          b.isPublished
                            ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                            : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                        }`}
                      >
                        {b.isPublished ? 'منشور' : 'مسودة'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAccess(b.id)}
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg transition"
                        >
                          🔑 الوصول
                        </button>
                        <button
                          onClick={() => openEdit(b)}
                          className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-3 py-1.5 rounded-lg transition"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(b.id, b.title)}
                          disabled={mutatingBookId === b.id}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-gray-900">{editBook ? 'تعديل الكتاب' : 'إضافة كتاب جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">العنوان *</label>
                  <input value={form.title} onChange={f('title')} className={inputCls} placeholder="عنوان الكتاب" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">لغة الكتاب</label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { id: 'ar', label: 'عربي' },
                      { id: 'en', label: 'English' },
                      { id: 'ur', label: 'اردو' },
                      { id: 'id', label: 'Indonesia' },
                      { id: 'de', label: 'Deutsch' },
                      { id: 'fr', label: 'Français' },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, language: opt.id }))}
                        className={`py-2 rounded-xl text-xs font-black border-2 transition ${
                          (form as typeof form & { language?: string }).language === opt.id
                            ? 'border-[#F5C518] bg-amber-50 text-[#1a1a2e]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">القسم</label>
                  <div className="flex gap-2">
                    {([['books', 'كتب وروايات'], ['stories', 'قصص تربوية']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, section: val }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition ${
                          (form as typeof form & { section?: string }).section === val
                            ? 'border-[#F5C518] bg-amber-50 text-[#1a1a2e]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">العنوان بالإنجليزية</label>
                  <input value={form.titleEn} onChange={f('titleEn')} className={inputCls} placeholder="Book Title" dir="ltr" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">المؤلف</label>
                  <input value={form.author} onChange={f('author')} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">التصنيف</label>
                  <input value={form.category} onChange={f('category')} className={inputCls} placeholder="مثال: تطوير ذاتي" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">الوصف</label>
                  <textarea value={form.description} onChange={f('description')} rows={3} className={inputCls + ' resize-none'} />
                </div>
              </div>

              {/* Age range & parental guidance */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">الفئة العمرية</p>
                <div className="space-y-3">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">من سن</label>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={form.minAge}
                        onChange={f('minAge')}
                        className={inputCls + ' w-20'}
                        dir="ltr"
                        placeholder="٤"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">إلى سن</label>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={isOpenEnded ? '' : form.maxAge}
                        onChange={f('maxAge')}
                        disabled={isOpenEnded}
                        className={inputCls + ' w-20 disabled:opacity-40 disabled:bg-gray-50 disabled:cursor-not-allowed'}
                        dir="ltr"
                        placeholder="٨"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                      <input
                        type="checkbox"
                        checked={isOpenEnded}
                        onChange={e => {
                          setIsOpenEnded(e.target.checked);
                          if (e.target.checked) setForm(p => ({ ...p, maxAge: '' }));
                        }}
                        className="w-4 h-4 accent-amber-400"
                      />
                      <span className="text-sm text-gray-700">مفتوح (+)</span>
                    </label>
                  </div>
                  {checkRow('needsParentalGuide', 'يحتاج مساعدة الوالدين')}
                  {form.minAge !== '' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">معاينة:</span>
                      <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold px-3 py-1 rounded-full">
                        {formatAgeLabel(
                          Number(form.minAge),
                          isOpenEnded ? null : (form.maxAge !== '' ? Number(form.maxAge) : null),
                          form.needsParentalGuide,
                          'ar',
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing & pages */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    السعر بالجنيه المصري (ج.م)
                    <span className="mr-1 text-xs font-normal text-gray-400">— للمستخدمين في مصر</span>
                  </label>
                  <div className="relative">
                    <input type="number" min={0} value={form.price} onChange={f('price')} className={inputCls + ' pl-12'} dir="ltr" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600">ج.م</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    السعر بالدولار (USD)
                    <span className="mr-1 text-xs font-normal text-gray-400">— للمستخدمين خارج مصر</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number" min={0} step="0.01"
                      value={(form as typeof form & { priceUSD?: number }).priceUSD || ''}
                      onChange={f('priceUSD')}
                      className={inputCls + ' pl-12'}
                      dir="ltr"
                      placeholder={form.price > 0 ? `تلقائي: ${(form.price * 0.10).toFixed(2)}` : '0.00'}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600">$</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">اتركه فارغاً للحساب التلقائي (سعر الجنيه ÷ 50)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">صفحات مجانية</label>
                  <input type="number" min={0} value={form.freePages} onChange={f('freePages')} className={inputCls} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">إجمالي الصفحات</label>
                  <input type="number" min={0} value={form.totalPages} onChange={f('totalPages')} className={inputCls} dir="ltr" />
                </div>
              </div>

              {/* File uploads */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">ملف PDF</label>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-400 transition"
                    onClick={() => pdfRef.current?.click()}
                  >
                    {pdfFile ? (
                      <p className="text-sm text-green-600 font-bold">{pdfFile.name}</p>
                    ) : (
                      <p className="text-sm text-gray-400">{editBook ? 'رفع PDF جديد (اختياري)' : 'اختر ملف PDF'}</p>
                    )}
                  </div>
                  <input
                    ref={pdfRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      if (f && f.size > 90 * 1024 * 1024) {
                        addToast('حجم الـ PDF كبير جداً — الحد الأقصى 90 ميجابايت', 'error');
                        e.target.value = '';
                        return;
                      }
                      setPdfFile(f);
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">صورة الغلاف</label>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-amber-400 transition overflow-hidden"
                    onClick={() => coverRef.current?.click()}
                  >
                    {coverFile ? (
                      <div className="space-y-2">
                        <Image
                          src={URL.createObjectURL(coverFile)}
                          alt="cover preview"
                          width={80}
                          height={110}
                          className="mx-auto rounded-lg object-cover shadow-sm"
                          unoptimized
                        />
                        <p className="text-xs text-green-600 font-bold truncate">{coverFile.name}</p>
                        <p className="text-[10px] text-gray-400">اضغط لتغيير الصورة</p>
                      </div>
                    ) : uploadedCoverUrl ? (
                      <div className="space-y-2">
                        <Image
                          src={uploadedCoverUrl}
                          alt="cover"
                          width={80}
                          height={110}
                          className="mx-auto rounded-lg object-cover shadow-sm"
                          unoptimized
                        />
                        <p className="text-[10px] text-gray-400">اضغط لتغيير الغلاف</p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <p className="text-3xl mb-2">🖼️</p>
                        <p className="text-sm text-gray-400">اختر صورة الغلاف</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={coverRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {/* Security & Features */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">الحماية والميزات</p>
                <div className="grid grid-cols-2 gap-3">
                  {checkRow('enableWatermark', 'علامة مائية على الصفحات')}
                  {checkRow('enableForensic', 'تتبع جنائي (Forensic)')}
                  {checkRow('allowQuoteShare', 'مشاركة اقتباسات كصور')}
                  {checkRow('isPublished', 'نشر الكتاب للعموم')}
                </div>
              </div>

              {/* Paper product slug */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">النسخة الورقية</p>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Slug المنتج الورقي (مثال: fakih-in-wonderland-book)</label>
                  <input
                    type="text"
                    value={form.paperProductSlug || ''}
                    onChange={e => setForm(prev => ({ ...prev, paperProductSlug: e.target.value }))}
                    className={inputCls}
                    dir="ltr"
                    placeholder="اتركه فارغاً إذا لم تكن هناك نسخة ورقية"
                  />
                  <p className="text-xs text-gray-400 mt-1">سيظهر زر "اشترِ النسخة الورقية" يوجه لصفحة /shop/[slug]</p>
                </div>
              </div>
              {/* Media: BGM + Promo Video */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">الموسيقى والفيديو</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">موسيقى الخلفية (MP3)</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input ref={audioRef} type="file" accept=".mp3,.ogg,.wav,.m4a" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setAudioFile(f); setForm(prev => ({ ...prev, bgmUrl: '' })); } }} />
                      <button type="button" onClick={() => audioRef.current?.click()}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition">
                        {audioFile ? audioFile.name : 'رفع ملف MP3'}
                      </button>
                      {audioFile && (
                        <button type="button" onClick={() => { setAudioFile(null); if (audioRef.current) audioRef.current.value = ''; }}
                          className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition">
                          ✕ إلغاء الملف
                        </button>
                      )}
                      {form.bgmUrl && !audioFile && (
                        <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                          ✓ موسيقى محفوظة
                          <button type="button" onClick={() => setForm(prev => ({ ...prev, bgmUrl: '' }))}
                            className="text-red-400 hover:text-red-600 font-black ml-1">✕</button>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">أو أدخل رابط مباشر للملف (سيستبدل الملف المرفوع):</p>
                    <input type="text" value={form.bgmUrl || ''} dir="ltr"
                      onChange={e => { setAudioFile(null); setForm(prev => ({ ...prev, bgmUrl: e.target.value })); }}
                      className={inputCls} placeholder="https://... أو /audio/filename.mp3" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">رابط فيديو البرومو (YouTube)</label>
                    <input type="text" value={form.promoVideoUrl || ''} dir="ltr"
                      onChange={e => setForm(prev => ({ ...prev, promoVideoUrl: e.target.value }))}
                      className={inputCls} placeholder="https://www.youtube.com/watch?v=..." />
                    <p className="text-xs text-gray-400 mt-1">سيظهر كبطاقة صغيرة أثناء القراءة (مرة واحدة فقط)</p>
                  </div>
                </div>
              </div>
              {/* Friend share */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">المشاركة مع صديق</p>
                <div className="space-y-3">
                  {checkRow('allowFriendShare', 'السماح بمشاركة الكتاب مع صديق')}
                  {form.allowFriendShare && (
                    <div className="mr-7">
                      <label className="text-xs text-gray-500 mb-1 block">مدة الوصول للصديق (ساعات)</label>
                      <input type="number" min={1} max={168} value={form.friendShareHours} onChange={f('friendShareHours')} className={inputCls + ' w-32'} dir="ltr" />
                    </div>
                  )}
                </div>
              </div>

              {/* Referral */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">مشاركة الكتاب ومكافأة المُوصي</p>
                <p className="text-xs text-gray-400 mb-3">إذا شارك عميل رابط الكتاب لصديق واشترى الصديق، يحصل المُوصي تلقائيًا على كوبون خصم.</p>
                <div className="space-y-3">
                  {checkRow('enableReferral', 'تفعيل المشاركة والمكافأة')}
                  {form.enableReferral && (
                    <div className="mr-7 space-y-1">
                      <label className="text-xs text-gray-500 block">نسبة الخصم التي يحصل عليها المُوصي (%)</label>
                      <p className="text-[11px] text-gray-400">مثال: 20% تعني أن المُوصي يحصل على كوبون خصم 20% على كتاب آخر</p>
                      <input type="number" min={1} max={100} value={form.referralDiscount} onChange={f('referralDiscount')} className={inputCls + ' w-32'} dir="ltr" />
                    </div>
                  )}
                </div>
              </div>

              {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 space-y-3">
              {uploading && uploadProgress > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>جارٍ رفع الملف…</span>
                    <span className="font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2" dir="ltr">
                    <div
                      className="bg-[#F5C518] h-2 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 hover:border-gray-400 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black py-2.5 rounded-xl text-sm transition disabled:opacity-60"
                >
                  {uploading ? (uploadProgress > 0 ? `${uploadProgress}%` : 'جارٍ الرفع...') : saving ? 'جارٍ الحفظ...' : editBook ? 'حفظ التعديلات' : 'إضافة الكتاب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Access Management Modal ── */}
      {accessBookId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setAccessBookId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-black text-gray-900">🔑 إدارة الوصول</h2>
                {accessBook && <p className="text-xs text-gray-400">{accessBook.title}</p>}
              </div>
              <button onClick={() => setAccessBookId(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100">
              <label className="text-xs font-bold text-gray-500 mb-2 block">منح وصول لمستخدم (بالإيميل)</label>
              <div className="flex gap-2">
                <input
                  value={grantEmail}
                  onChange={e => setGrantEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGrant()}
                  placeholder="user@example.com"
                  className={inputCls + ' flex-1'}
                  dir="ltr"
                />
                <button
                  onClick={handleGrant}
                  disabled={grantLoading}
                  className="bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black px-4 rounded-xl text-sm transition disabled:opacity-60"
                >
                  {grantLoading ? '...' : 'منح'}
                </button>
              </div>
              {grantMsg && (
                <p className={`text-xs mt-2 ${grantMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{grantMsg}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {accessLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : accesses.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">لا يوجد قراء لهذا الكتاب بعد</p>
              ) : (
                <div className="space-y-2">
                  {accesses.map(a => (
                    <div key={a.user.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{a.user.name}</p>
                        <p className="text-xs text-gray-400">{a.user.email} · ص{a.lastPage} · {new Date(a.grantedAt).toLocaleDateString('en-GB')}</p>
                      </div>
                      <button
                        onClick={() => handleRevoke(a.user.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        سحب
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
