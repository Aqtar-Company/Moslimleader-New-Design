'use client';
import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/lib/free-media-upload';
import Icon from '@/components/media/Icon';

/**
 * The /media page's hero image. One picture behind the page's title; without one the band
 * stays plain navy as before.
 *
 * Size: 1920×640 (3:1). The band is wide and short on a computer and nearly square on a
 * phone, so a phone shows only the MIDDLE of the picture — whatever matters belongs there.
 */
export default function MediaHeroAdmin() {
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/free-media/hero', { signal: AbortSignal.timeout(15_000) })
      .then(r => r.json()).then(d => setUrl(d.url ?? null)).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  async function save(next: string | null) {
    const r = await fetch('/api/admin/free-media/hero', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: next }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { setError(d?.error ?? 'تعذّر الحفظ'); return; }
    setUrl(d.url ?? null);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(''); setPct(0);
    const up = await uploadFile(file, 'hero', setPct);
    if (up.url) await save(up.url); else setError(up.error ?? 'فشل الرفع');
    setPct(null);
    if (input.current) input.current.value = '';
  }

  async function remove() {
    if (!confirm('إزالة صورة الهيرو؟ الشريط يرجع لونه الكحلي العادي.')) return;
    setError('');
    await save(null);
  }

  const btn = 'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition disabled:opacity-50';

  return (
    <section className="bg-white border rounded-xl p-4 mb-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-bold text-gray-700 flex items-center gap-2"><Icon name="image" size={18} /> صورة الهيرو في صفحة الوسائط</h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            المقاس: <b dir="ltr">1920 × 640</b> بكسل (عرض 3 أضعاف الارتفاع)، JPG أو PNG أو WebP، حتى 25 ميجا — تُضغط تلقائياً.
            <br />الموبايل يعرض <b>منتصف الصورة فقط</b>، فخلّي المهم في النص. العنوان والبحث بيظهروا تحت فوق الصورة.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => input.current?.click()} disabled={pct !== null || !loaded} className={`${btn} bg-[#1a1a2e] text-[#F5C518] border-[#1a1a2e]`}>
            <Icon name={pct !== null ? 'loader' : 'upload'} size={15} spin={pct !== null} />
            {pct !== null ? `جارٍ الرفع ${pct}%` : url ? 'تغيير الصورة' : 'رفع صورة'}
          </button>
          {url && pct === null && (
            <button onClick={() => void remove()} className={`${btn} bg-white text-red-600 hover:bg-red-50`}><Icon name="trash" size={15} /> إزالة</button>
          )}
        </div>
        <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={e => void pick(e.target.files?.[0])} />
      </div>

      {error && <p className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><Icon name="alert" size={16} /> {error}</p>}

      {/* Preview at the band's real shape: wide on a computer, the centre on a phone. */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 mb-1">كمبيوتر</p>
          <div className="relative aspect-[1440/400] rounded-lg overflow-hidden bg-[#1a1a2e]">
            {url && <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/45 to-[#1a1a2e]/25" />
            <span className="absolute bottom-2 start-3 text-white font-black text-sm">وسائط مسلم ليدر</span>
          </div>
        </div>
        <div className="w-24 shrink-0">
          <p className="text-[11px] text-gray-400 mb-1">موبايل</p>
          <div className="relative aspect-[390/340] rounded-lg overflow-hidden bg-[#1a1a2e]">
            {url && <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/45 to-[#1a1a2e]/25" />
          </div>
        </div>
      </div>
    </section>
  );
}
