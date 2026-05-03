'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sanitizeHtml } from '@/lib/sanitize';

interface Segment { key: string; label: string; icon: string }

const SEGMENTS: Segment[] = [
  { key: 'all',        label: 'الكل',                icon: '👥' },
  { key: 'vip',        label: 'VIP',                 icon: '👑' },
  { key: 'active',     label: 'نشطون',               icon: '🔥' },
  { key: 'repeat',     label: 'متكررون',             icon: '🔁' },
  { key: 'single',     label: 'مرة واحدة',           icon: '🆕' },
  { key: 'dormant',    label: 'نائمون',              icon: '💤' },
  { key: 'bought_all', label: 'اشتروا كل المنتجات',  icon: '✨' },
];

const TEMPLATE_DEFAULT = `<h2 style="color:#1a1a2e">مرحبًا {{firstName}} 👋</h2>
<p>وحشتنا في Moslim Leader! لقينا حاجة جديدة فكّرنا فيك ونحن بنطلقها.</p>
<p>عندنا منتج جديد ممكن يعجبك جدًا — وكوبون خصم خاص ليك:</p>
<p style="text-align:center;margin:24px 0">
  <span style="display:inline-block;padding:14px 28px;background:#F5C518;color:#1a1a2e;border-radius:12px;font-size:18px;font-weight:bold;font-family:monospace">{{couponCode}}</span>
</p>
<p style="text-align:center">
  <a href="https://moslimleader.com/shop" style="display:inline-block;padding:12px 28px;background:#1a1a2e;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold">تسوّق الآن</a>
</p>`;

export default function NewCampaignPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [segmentKey, setSegmentKey] = useState('all');
  const [subject, setSubject] = useState('عرض خاص ليك من Moslim Leader');
  const [bodyHtml, setBodyHtml] = useState(TEMPLATE_DEFAULT);
  const [couponCode, setCouponCode] = useState('');
  const [audienceCount, setAudienceCount] = useState(0);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [coupons, setCoupons] = useState<Array<{ code: string; discount: number; isActive: boolean }>>([]);
  const [creating, setCreating] = useState(false);

  const loadAudience = useCallback(async () => {
    setAudienceLoading(true);
    try {
      const res = await fetch(`/api/admin/customers?segment=${segmentKey}`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setAudienceCount((data.customers ?? []).filter((c: { email: string }) => c.email).length);
    } catch {}
    setAudienceLoading(false);
  }, [segmentKey]);

  useEffect(() => { loadAudience(); }, [loadAudience]);

  useEffect(() => {
    fetch('/api/admin/coupons', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCoupons((d.coupons ?? []).filter((c: { isActive: boolean }) => c.isActive)))
      .catch(() => {});
  }, []);

  const handleCreateAndSend = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      addToast('املأ كل الحقول المطلوبة', 'warning');
      return;
    }
    const ok = await confirm({
      title: 'إرسال الحملة',
      message: `هيتم إرسال الحملة لـ ${audienceCount} عميل عبر الإيميل. الإرسال هيستغرق وقت (~30 رسالة/دقيقة).`,
      confirmLabel: `إرسال لـ ${audienceCount}`,
      cancelLabel: 'إلغاء',
      icon: '📨',
    });
    if (!ok) return;

    setCreating(true);
    try {
      const createRes = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, segmentKey, subject, bodyHtml, couponCode: couponCode || null }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        addToast(createData.error || 'فشل إنشاء الحملة', 'error');
        setCreating(false);
        return;
      }
      const sendRes = await fetch(`/api/admin/campaigns/${createData.campaign.id}/send`, {
        method: 'POST', credentials: 'include',
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        addToast(sendData.error || 'فشل بدء الإرسال', 'error');
      } else {
        addToast(`بدأ إرسال الحملة لـ ${sendData.queued} عميل`, 'success', 5000);
        router.push(`/admin/campaigns/${createData.campaign.id}`);
      }
    } catch {
      addToast('فشل العملية', 'error');
    }
    setCreating(false);
  };

  const handleSaveDraft = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      addToast('املأ كل الحقول المطلوبة', 'warning');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, segmentKey, subject, bodyHtml, couponCode: couponCode || null }),
      });
      const data = await res.json();
      if (!res.ok) addToast(data.error || 'فشل الحفظ', 'error');
      else {
        addToast('تم حفظ المسودة', 'success');
        router.push('/admin/campaigns');
      }
    } catch {
      addToast('فشل الحفظ', 'error');
    }
    setCreating(false);
  };

  return (
    <div className="space-y-5">
      <Link href="/admin/campaigns" className="text-xs text-gray-500 hover:text-gray-900">← العودة للحملات</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Composer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">📝 محتوى الحملة</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">اسم الحملة (داخلي فقط)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: ترويج رمضان 2026"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">عنوان الإيميل (Subject)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">يقبل: <code>{'{{firstName}}'}</code> · <code>{'{{name}}'}</code> · <code>{'{{couponCode}}'}</code></p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">المحتوى (HTML)</label>
                <textarea
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  rows={14}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-gray-400 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  بنضيف تلقائيًا footer لإلغاء الاشتراك + tracking pixel + click tracking على كل الـ links.
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">👁️ معاينة</h2>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="bg-white rounded-lg p-4 border border-gray-100 max-w-md mx-auto">
                <p className="text-xs text-gray-500 border-b pb-2 mb-3">
                  <span className="font-bold">الموضوع:</span> {subject.replace(/\{\{firstName\}\}/g, 'أحمد').replace(/\{\{couponCode\}\}/g, couponCode || 'XXXXX')}
                </p>
                <div
                  className="prose prose-sm max-w-none"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      bodyHtml
                        .replace(/\{\{firstName\}\}/g, 'أحمد')
                        .replace(/\{\{name\}\}/g, 'أحمد محمد')
                        .replace(/\{\{couponCode\}\}/g, couponCode || 'XXXXX'),
                    ),
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">🎯 الجمهور</h2>
            <div className="space-y-1.5">
              {SEGMENTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSegmentKey(s.key)}
                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                    segmentKey === s.key
                      ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-emerald-700 font-bold">عدد المستلمين</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {audienceLoading ? '...' : audienceCount}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-black text-gray-900 mb-3">🎟️ كوبون (اختياري)</h2>
            <select
              value={couponCode}
              onChange={e => setCouponCode(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
            >
              <option value="">— لا يوجد —</option>
              {coupons.map(c => (
                <option key={c.code} value={c.code}>{c.code} ({c.discount}%)</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-2">سيُرفق الكود في الإيميل عبر <code>{'{{couponCode}}'}</code>.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
            <button
              onClick={handleCreateAndSend}
              disabled={creating || audienceCount === 0}
              className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition shadow-sm"
            >
              📨 إرسال الحملة
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={creating}
              className="w-full px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition"
            >
              💾 حفظ كمسودة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
