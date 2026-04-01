'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface SeriesBook {
  id: string;
  title: string;
  titleEn?: string;
  cover: string;
  price: number;
  seriesOrder?: number;
  language?: string;
  isPublished: boolean;
}

interface BookSeries {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  description?: string;
  descriptionEn?: string;
  cover?: string;
  seriesPrice?: number;
  seriesPriceUSD?: number;
  language?: string;
  isPublished: boolean;
  books: SeriesBook[];
}

interface AllBook {
  id: string;
  title: string;
  titleEn?: string;
  cover: string;
  price: number;
  language?: string;
  seriesId?: string;
  seriesOrder?: number;
}

const emptyForm = {
  name: '',
  nameEn: '',
  slug: '',
  description: '',
  descriptionEn: '',
  cover: '',
  seriesPrice: '',
  seriesPriceUSD: '',
  language: 'both',
  isPublished: true,
};

export default function AdminSeriesPage() {
  const [series, setSeries] = useState<BookSeries[]>([]);
  const [allBooks, setAllBooks] = useState<AllBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Book assignment state
  const [assignSeriesId, setAssignSeriesId] = useState<string | null>(null);
  const [bookOrders, setBookOrders] = useState<Record<string, { seriesId: string; order: number }>>({});

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]/50 bg-white';

  const load = async () => {
    setLoading(true);
    try {
      const [sr, br] = await Promise.all([
        fetch('/api/admin/series').then(r => r.json()),
        fetch('/api/admin/books').then(r => r.json()),
      ]);
      setSeries(sr.series || []);
      setAllBooks(br.books || []);

      // Build bookOrders map
      const orders: Record<string, { seriesId: string; order: number }> = {};
      (br.books || []).forEach((b: AllBook) => {
        if (b.seriesId) {
          orders[b.id] = { seriesId: b.seriesId, order: b.seriesOrder || 1 };
        }
      });
      setBookOrders(orders);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'cover');
    const r = await fetch('/api/admin/books/upload', { method: 'POST', body: fd });
    const d = await r.json();
    return d.url || '';
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) return alert('الاسم والـ slug مطلوبان');
    setSaving(true);
    try {
      let coverUrl = form.cover;
      if (coverFile) {
        coverUrl = await uploadFile(coverFile);
      }

      const body = {
        ...form,
        cover: coverUrl || null,
        seriesPrice: form.seriesPrice ? parseFloat(form.seriesPrice) : null,
        seriesPriceUSD: form.seriesPriceUSD ? parseFloat(form.seriesPriceUSD) : null,
      };

      const url = editId ? `/api/admin/series/${editId}` : '/api/admin/series';
      const method = editId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) return alert(d.error || 'حدث خطأ');

      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setCoverFile(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: BookSeries) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      nameEn: s.nameEn || '',
      slug: s.slug,
      description: s.description || '',
      descriptionEn: s.descriptionEn || '',
      cover: s.cover || '',
      seriesPrice: s.seriesPrice?.toString() || '',
      seriesPriceUSD: s.seriesPriceUSD?.toString() || '',
      language: s.language || 'both',
      isPublished: s.isPublished,
    });
    setShowForm(true);
    setCoverFile(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`حذف سلسلة "${name}"؟ الكتب لن تُحذف لكن ستُفصل عن السلسلة.`)) return;
    await fetch(`/api/admin/series/${id}`, { method: 'DELETE' });
    await load();
  };

  // Assign/unassign a book to a series
  const handleAssignBook = async (bookId: string, seriesId: string | null, order: number) => {
    await fetch(`/api/admin/books/${bookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesId: seriesId || null, seriesOrder: seriesId ? order : null }),
    });
    await load();
  };

  const getSeriesName = (id: string) => series.find(s => s.id === id)?.name || '';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">السلاسل</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة سلاسل القصص والكتب</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); setCoverFile(null); }}
          className="px-4 py-2 bg-[#F5C518] hover:bg-[#e6b800] text-[#1a1a2e] text-sm font-black rounded-xl transition"
        >
          + سلسلة جديدة
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 mb-4">{editId ? 'تعديل السلسلة' : 'سلسلة جديدة'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">الاسم (عربي) *</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="سلسلة ابني يسأل" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">الاسم (إنجليزي)</label>
              <input className={inputCls} dir="ltr" value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} placeholder="My Son Asks Series" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Slug (رابط فريد) *</label>
              <input className={inputCls} dir="ltr" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="my-son-asks" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">اللغة</label>
              <select className={inputCls} value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                <option value="ar">عربي فقط</option>
                <option value="en">إنجليزي فقط</option>
                <option value="both">عربي وإنجليزي</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">سعر السلسلة كاملة (ج.م)</label>
              <input className={inputCls} type="number" value={form.seriesPrice} onChange={e => setForm(p => ({ ...p, seriesPrice: e.target.value }))} placeholder="99" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">سعر السلسلة كاملة ($)</label>
              <input className={inputCls} type="number" dir="ltr" value={form.seriesPriceUSD} onChange={e => setForm(p => ({ ...p, seriesPriceUSD: e.target.value }))} placeholder="9.99" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 mb-1 block">الوصف (عربي)</label>
              <textarea className={inputCls} rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="وصف السلسلة..." />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 mb-1 block">الوصف (إنجليزي)</label>
              <textarea className={inputCls} rows={2} dir="ltr" value={form.descriptionEn} onChange={e => setForm(p => ({ ...p, descriptionEn: e.target.value }))} placeholder="Series description..." />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">صورة السلسلة</label>
              <div className="flex items-center gap-2">
                <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setCoverFile(f); }} />
                <button type="button" onClick={() => coverRef.current?.click()} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition">
                  {coverFile ? coverFile.name : 'رفع صورة'}
                </button>
                {form.cover && !coverFile && <span className="text-xs text-green-600 font-bold">✓ صورة محفوظة</span>}
              </div>
              {form.cover && !coverFile && (
                <input className={`${inputCls} mt-2`} dir="ltr" value={form.cover} onChange={e => setForm(p => ({ ...p, cover: e.target.value }))} placeholder="رابط الصورة" />
              )}
            </div>
            <div className="flex items-center gap-3 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={e => setForm(p => ({ ...p, isPublished: e.target.checked }))} className="w-4 h-4 accent-[#F5C518]" />
                <span className="text-sm font-semibold text-gray-700">منشورة</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-[#F5C518] hover:bg-[#e6b800] text-[#1a1a2e] text-sm font-black rounded-xl transition disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : (editId ? 'حفظ التعديلات' : 'إنشاء السلسلة')}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Series list */}
      <div className="space-y-4">
        {series.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">📚</p>
            <p className="font-semibold">لا توجد سلاسل بعد</p>
          </div>
        )}
        {series.map(s => (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Series header */}
            <div className="flex items-center gap-4 p-5">
              {s.cover && (
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  <Image src={s.cover} alt={s.name} width={56} height={56} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-gray-900 text-lg">{s.name}</h3>
                  {s.nameEn && <span className="text-sm text-gray-400 font-medium">{s.nameEn}</span>}
                  {!s.isPublished && <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full font-bold">مخفية</span>}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span>{s.books.length} كتاب/قصة</span>
                  {s.seriesPrice && <span className="text-[#F5C518] font-bold">السلسلة كاملة: {s.seriesPrice} ج.م</span>}
                  {s.seriesPriceUSD && <span className="text-green-600 font-bold">${s.seriesPriceUSD}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setExpandedSeries(expandedSeries === s.id ? null : s.id)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition">
                  {expandedSeries === s.id ? 'إخفاء' : 'إدارة الكتب'}
                </button>
                <button onClick={() => handleEdit(s)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-lg transition">
                  تعديل
                </button>
                <button onClick={() => handleDelete(s.id, s.name)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition">
                  حذف
                </button>
              </div>
            </div>

            {/* Books in series */}
            {expandedSeries === s.id && (
              <div className="border-t border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-700 text-sm">كتب/قصص السلسلة</h4>
                  <p className="text-xs text-gray-400">اضغط على كتاب لتغيير ترتيبه أو إزالته</p>
                </div>

                {/* Current books in series */}
                <div className="space-y-2 mb-4">
                  {s.books.length === 0 && <p className="text-sm text-gray-400 text-center py-4">لا توجد كتب في هذه السلسلة بعد</p>}
                  {s.books.map(b => (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="w-7 h-7 rounded-lg bg-[#F5C518]/20 text-[#1a1a2e] text-xs font-black flex items-center justify-center shrink-0">
                        {b.seriesOrder || '?'}
                      </span>
                      {b.cover && (
                        <div className="w-8 h-10 rounded overflow-hidden shrink-0 bg-gray-200">
                          <Image src={b.cover} alt={b.title} width={32} height={40} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{b.title}</p>
                        {b.titleEn && <p className="text-xs text-gray-400 truncate">{b.titleEn}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={1}
                          defaultValue={b.seriesOrder || 1}
                          className="w-14 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center"
                          onBlur={e => handleAssignBook(b.id, s.id, parseInt(e.target.value) || 1)}
                          title="رقم الجزء"
                        />
                        <button
                          onClick={() => handleAssignBook(b.id, null, 0)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-black flex items-center justify-center transition"
                          title="إزالة من السلسلة"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add books from all books */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-gray-500 mb-3">إضافة كتاب للسلسلة:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {allBooks
                      .filter(b => !b.seriesId || b.seriesId !== s.id)
                      .map(b => (
                        <button
                          key={b.id}
                          onClick={() => {
                            const nextOrder = s.books.length + 1;
                            handleAssignBook(b.id, s.id, nextOrder);
                          }}
                          className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 hover:border-[#F5C518] hover:bg-amber-50 transition text-right"
                        >
                          {b.cover && (
                            <div className="w-8 h-10 rounded overflow-hidden shrink-0 bg-gray-100">
                              <Image src={b.cover} alt={b.title} width={32} height={40} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{b.title}</p>
                            {b.seriesId && b.seriesId !== s.id && (
                              <p className="text-xs text-orange-500">في: {getSeriesName(b.seriesId)}</p>
                            )}
                          </div>
                          <span className="text-[#F5C518] text-lg shrink-0">+</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
