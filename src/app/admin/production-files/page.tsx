'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { adminJson, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface FileProduct { id: string; name: string; slug: string }
interface ProductionFileRow {
  id: string;
  groupId: string;
  version: number;
  isLatest: boolean;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: string;
  productId: string | null;
  product: FileProduct | null;
  driveWebViewLink: string | null;
  driveDownloadLink: string | null;
  notes: string | null;
  uploadedByUserId: string | null;
  createdAt: string;
}

interface SimpleProduct { id: string; name: string }

const CATEGORIES: Record<string, string> = {
  'print-ready': 'جاهز للطباعة',
  'cover': 'غلاف',
  'proof': 'بروف / مراجعة',
  'other': 'أخرى',
};

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ProductionFilesPage() {
  const { addToast } = useToast();
  const [files, setFiles] = useState<ProductionFileRow[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadGroupId, setUploadGroupId] = useState<string | null>(null); // null = new file
  const [uploading, setUploading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    category: 'print-ready',
    productId: '',
    notes: '',
  });

  async function load() {
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      const data = await adminJson<{ files: ProductionFileRow[] }>(`/api/admin/production-files?${params.toString()}`);
      setFiles(data.files);
    } catch (e) {
      if (e instanceof ForbiddenError) { setForbidden(true); return; }
      addToast('فشل تحميل الملفات', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const data = await adminJson<{ products: SimpleProduct[] }>('/api/admin/products?limit=200');
      setProducts((data.products ?? []).map((p: SimpleProduct) => ({ id: p.id, name: p.name })));
    } catch { /* non-blocking */ }
  }

  useEffect(() => { load(); loadProducts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading) { setLoading(true); load(); } }, [categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const fileEl = fileInputRef.current;
    if (!fileEl?.files?.[0]) { addToast('اختر ملفاً أولاً', 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', fileEl.files[0]);
      fd.append('category', form.category);
      if (form.productId) fd.append('productId', form.productId);
      if (form.notes) fd.append('notes', form.notes);
      if (uploadGroupId) fd.append('groupId', uploadGroupId);

      const data = await adminJson<{ file: ProductionFileRow }>('/api/admin/production-files/upload', { method: 'POST', body: fd, headers: {} });
      addToast(uploadGroupId ? 'تم رفع النسخة الجديدة بنجاح ✅' : 'تم رفع الملف على Google Drive بنجاح ✅', 'success');
      const prevGroupId = uploadGroupId;
      setShowUpload(false);
      setUploadGroupId(null);
      setForm({ category: 'print-ready', productId: '', notes: '' });
      if (fileEl) fileEl.value = '';
      setFiles(prev => {
        if (prevGroupId) {
          return [data.file, ...prev.map((f: ProductionFileRow) => f.groupId === prevGroupId && f.isLatest ? { ...f, isLatest: false } : f)];
        }
        return [data.file, ...prev];
      });
    } catch (err) {
      addToast((err as Error).message || 'فشل رفع الملف', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file: ProductionFileRow) {
    if (!confirm(`حذف "${file.fileName}"؟ سيُحذف من Google Drive أيضاً.`)) return;
    try {
      await adminJson(`/api/admin/production-files/${file.id}`, { method: 'DELETE' });
      addToast('تم الحذف', 'success');
      setFiles(prev => prev.filter(f => f.id !== file.id));
    } catch {
      addToast('فشل الحذف', 'error');
    }
  }

  function openNewVersion(file: ProductionFileRow) {
    setUploadGroupId(file.groupId);
    setForm({ category: file.category, productId: file.productId ?? '', notes: '' });
    setShowUpload(true);
  }

  if (forbidden) return <ForbiddenState />;

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">📁 ملفات الإنتاج</h1>
          <p className="text-sm text-gray-500 mt-1">ملفات الطباعة والملفات الفاينال — محفوظة على Google Drive</p>
        </div>
        <button
          onClick={() => { setUploadGroupId(null); setShowUpload(true); }}
          className="bg-[#6B21A8] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#7e22ce] transition-colors"
        >
          + رفع ملف جديد
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[['', 'الكل'], ...Object.entries(CATEGORIES)].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setCategoryFilter(val)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${categoryFilter === val ? 'bg-[#6B21A8] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">لا توجد ملفات بعد</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['اسم الملف', 'التصنيف', 'المنتج', 'النسخة', 'الحجم', 'التاريخ', 'إجراءات'].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-bold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {files.map(file => (
                  <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <a
                        href={file.driveWebViewLink ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#6B21A8] hover:underline truncate max-w-[200px] block"
                        title={file.fileName}
                      >
                        {file.fileName}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        {CATEGORIES[file.category] ?? file.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {file.product?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">
                        v{file.version}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatBytes(file.fileSize)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(file.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={`/api/admin/production-files/${file.id}/download`}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                        >
                          تحميل
                        </a>
                        {file.driveWebViewLink && (
                          <a
                            href={file.driveWebViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                          >
                            Drive
                          </a>
                        )}
                        <button
                          onClick={() => openNewVersion(file)}
                          className="bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                        >
                          نسخة جديدة
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
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

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl">
            <h2 className="text-lg font-black text-gray-900 mb-4">
              {uploadGroupId ? '📤 رفع نسخة جديدة' : '📤 رفع ملف جديد'}
            </h2>
            <form onSubmit={handleUpload} className="space-y-4">
              {/* File picker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الملف</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  className="w-full text-sm text-gray-600 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#6B21A8] file:text-white file:text-xs file:font-medium cursor-pointer"
                />
              </div>

              {/* Category */}
              {!uploadGroupId && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">التصنيف</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B21A8]"
                  >
                    {Object.entries(CATEGORIES).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product link (optional) */}
              {!uploadGroupId && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">منتج مرتبط (اختياري)</label>
                  <select
                    value={form.productId}
                    onChange={e => setForm(p => ({ ...p, productId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B21A8]"
                  >
                    <option value="">— بدون ربط بمنتج —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات (اختياري)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="مثال: نسخة مُصحَّحة بعد مراجعة المطبعة..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B21A8] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 bg-[#6B21A8] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#7e22ce] disabled:opacity-50 transition-colors"
                >
                  {uploading ? 'جاري الرفع على Drive...' : 'رفع الملف'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setUploadGroupId(null); }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
