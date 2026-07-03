'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminJson, ForbiddenError } from '@/lib/admin-fetch';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

interface ProductionFile {
  id: string;
  groupId: string;
  title: string;
  fileType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isLatest: boolean;
  status: string;
  notes: string | null;
  productId: string | null;
  createdAt: string;
}

const FILE_TYPES = [
  { value: 'design', label: 'تصميم' },
  { value: 'proof', label: 'بروف' },
  { value: 'print-ready', label: 'جاهز للطباعة' },
  { value: 'mockup', label: 'موك أب' },
  { value: 'other', label: 'أخرى' },
];

const STATUSES = [
  { value: 'draft', label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  { value: 'approved', label: 'معتمد', color: 'bg-green-100 text-green-700' },
  { value: 'sent-to-printer', label: 'أُرسل للطباعة', color: 'bg-blue-100 text-blue-700' },
  { value: 'done', label: 'منتهي', color: 'bg-purple-100 text-purple-700' },
];

const ALLOWED_ACCEPT = '.pdf,.ai,.eps,.png,.jpg,.jpeg,.tiff,.tif,.webp,.psd,.zip';

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: string) {
  const s = STATUSES.find(x => x.value === status);
  return s ? (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
  ) : null;
}

export default function ProductionFilesPage() {
  const { addToast } = useToast();
  const [files, setFiles] = useState<ProductionFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<ProductionFile | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'processing'>('uploading');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formFileType, setFormFileType] = useState('design');
  const [formNotes, setFormNotes] = useState('');
  const [formGroupId, setFormGroupId] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await adminJson<{ files: ProductionFile[] }>(`/api/admin/production-files${q}`);
      setFiles(res.files);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        setForbidden(true);
      } else {
        addToast('فشل تحميل الملفات', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [search, addToast]);

  useEffect(() => {
    setLoading(true);
    fetchFiles();
  }, [fetchFiles]);

  function resetModal() {
    setFormTitle('');
    setFormFileType('design');
    setFormNotes('');
    setFormGroupId('');
    setFormFile(null);
    setUploading(false);
    setUploadProgress(0);
    setUploadPhase('uploading');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openUploadModal(groupId = '') {
    resetModal();
    setFormGroupId(groupId);
    setShowModal(true);
  }

  function closeModal() {
    if (uploading) return;
    setShowModal(false);
    resetModal();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!formFile || !formTitle.trim()) {
      addToast('العنوان والملف مطلوبان', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('file', formFile);
    fd.append('title', formTitle.trim());
    fd.append('fileType', formFileType);
    fd.append('notes', formNotes.trim());
    if (formGroupId) fd.append('groupId', formGroupId);

    setUploading(true);
    setUploadProgress(0);
    setUploadPhase('uploading');

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', ev => {
      if (ev.lengthComputable) {
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    });

    xhr.upload.addEventListener('load', () => {
      setUploadProgress(100);
      setUploadPhase('processing');
    });

    xhr.addEventListener('load', () => {
      let data: { ok?: boolean; file?: ProductionFile; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        addToast('تم رفع الملف بنجاح', 'success');
        setShowModal(false);
        resetModal();
        fetchFiles();
      } else {
        addToast(data.error ?? 'فشل الرفع', 'error');
        setUploading(false);
      }
    });

    xhr.addEventListener('error', () => {
      addToast('خطأ في الاتصال أثناء الرفع', 'error');
      setUploading(false);
    });

    xhr.open('POST', '/api/admin/production-files/upload');
    xhr.send(fd);
  }

  async function handleStatusChange(file: ProductionFile, status: string) {
    try {
      await adminJson(`/api/admin/production-files/${file.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status } : f));
    } catch {
      addToast('فشل تحديث الحالة', 'error');
    }
  }

  async function handleDelete(file: ProductionFile) {
    if (!confirm(`حذف "${file.title}" (v${file.version})؟`)) return;
    try {
      await adminJson(`/api/admin/production-files/${file.id}`, { method: 'DELETE' });
      addToast('تم حذف الملف', 'success');
      fetchFiles();
    } catch {
      addToast('فشل الحذف', 'error');
    }
  }

  if (forbidden) return <ForbiddenState />;

  const filtered = files.filter(f =>
    !search || f.title.includes(search) || f.fileName.includes(search)
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">ملفات الإنتاج</h1>
        <button
          onClick={() => openUploadModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + رفع ملف جديد
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="بحث بالعنوان أو اسم الملف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-80 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="لا توجد ملفات إنتاج بعد" />
      ) : (
        <div className="space-y-3">
          {filtered.map(file => (
            <div key={file.id} className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              {/* File icon */}
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 text-lg font-bold uppercase text-xs">
                  {file.fileName.split('.').pop()?.toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{file.title}</span>
                  <span className="text-xs text-gray-400">v{file.version}</span>
                  {statusBadge(file.status)}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {FILE_TYPES.find(t => t.value === file.fileType)?.label ?? file.fileType}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  <span>{file.fileName}</span>
                  <span>{fmtSize(file.sizeBytes)}</span>
                  <span>{new Date(file.createdAt).toLocaleDateString('ar-EG')}</span>
                  {file.notes && <span className="truncate max-w-[200px]">{file.notes}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Status select */}
                <select
                  value={file.status}
                  onChange={e => handleStatusChange(file, e.target.value)}
                  className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                {/* Preview */}
                {file.mimeType === 'application/pdf' && (
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-lg"
                  >
                    معاينة
                  </button>
                )}

                {/* Download */}
                <a
                  href={`/api/admin/production-files/${file.id}/download`}
                  download={file.fileName}
                  className="text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 px-3 py-1 rounded-lg"
                >
                  تحميل
                </a>

                {/* New version */}
                <button
                  onClick={() => openUploadModal(file.groupId)}
                  title="رفع نسخة جديدة"
                  className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-lg"
                >
                  نسخة جديدة
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(file)}
                  className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded-lg"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">
                {formGroupId ? 'رفع نسخة جديدة' : 'رفع ملف إنتاج'}
              </h2>
              {!uploading && (
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              )}
            </div>
            <form onSubmit={handleUpload} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">العنوان *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  required
                  disabled={uploading}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
                  placeholder="مثال: غلاف كتاب التوحيد"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">نوع الملف</label>
                <select
                  value={formFileType}
                  onChange={e => setFormFileType(e.target.value)}
                  disabled={uploading}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {FILE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الملف *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_ACCEPT}
                  required
                  disabled={uploading}
                  onChange={e => setFormFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                />
                <p className="text-xs text-gray-400 mt-1">PDF, AI, EPS, PNG, JPG, TIFF, PSD, ZIP — حد 500 MB</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  disabled={uploading}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="ملاحظات اختيارية..."
                />
              </div>

              {/* Progress bar */}
              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>
                      {uploadPhase === 'uploading'
                        ? `جاري الرفع... ${uploadProgress}%`
                        : 'جاري المعالجة على Drive...'}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2" dir="ltr">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${uploadPhase === 'processing' ? 'bg-green-500 animate-pulse' : 'bg-indigo-500'}`}
                      style={{ width: `${uploadPhase === 'processing' ? 100 : uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={uploading || !formFile}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {uploading ? 'جاري الرفع...' : 'رفع الملف'}
                </button>
                {!uploading && (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 border border-gray-300 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-3 border-b flex-shrink-0" dir="rtl">
              <span className="font-medium text-sm truncate">{previewFile.title}</span>
              <div className="flex gap-2">
                <a
                  href={`/api/admin/production-files/${previewFile.id}/download`}
                  download={previewFile.fileName}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg"
                >
                  تحميل
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              src={`/api/admin/production-files/${previewFile.id}/download?inline=1`}
              className="flex-1 w-full rounded-b-2xl"
              title={previewFile.title}
            />
          </div>
        </div>
      )}
    </div>
  );
}
