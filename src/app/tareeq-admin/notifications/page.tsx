'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/tareeq-admin/AdminShell';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  muted: '#94a3b8',
  text: '#f1f5f9',
  gold: '#f59e0b',
};

export default function NotificationsPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'user'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [toastOk, setToastOk] = useState(true);

  const showToast = (msg: string, ok = true) => {
    setToast(msg);
    setToastOk(ok);
    setTimeout(() => setToast(''), 4000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      showToast('العنوان والمحتوى مطلوبان', false);
      return;
    }
    if (targetType === 'user' && !selectedUserId.trim() && !userSearch.trim()) {
      showToast('يرجى تحديد مستخدم', false);
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/tareeq-admin/notifications/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          url: url.trim() || undefined,
          targetType,
          userId: targetType === 'user' ? (selectedUserId || userSearch) : undefined,
        }),
      });

      if (res.status === 401) {
        router.push('/tareeq-admin/login');
        return;
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل الإرسال');

      showToast(`تم الإرسال بنجاح لـ ${json.sent} مستخدم`);
      setTitle('');
      setBody('');
      setUrl('');
      setUserSearch('');
      setSelectedUserId('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'حدث خطأ', false);
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminShell>
      <div dir="rtl" style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: 0 }}>
            🔔 إشعار متصفّح فوري
          </h1>
          <p style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
            إشعار واحد يظهر على الأجهزة التي فعّلت الإشعارات — لا يُحفَظ، ولا يظهر داخل
            التطبيق، ولا يُرسل إيميلًا.
          </p>
        </div>

        {/*
          Two screens in this project appear to do the same thing, and this is the one that
          does less. It sends a push and keeps NO record: no AdminBroadcast row, no in-app
          notification, no email, and nothing at all for a member who never enabled browser
          notifications — while still reporting success. An admin looking for "send a message
          to the members" finds this one first, sends from it, and then cannot find the
          message anywhere, because there is nothing to find. That happened, and the search
          for the cause began in SMTP, which this screen never touches.

          So the difference is stated here rather than left to be discovered.
        */}
        <div
          style={{
            background: '#3b1d08',
            border: '1px solid #f59e0b66',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 20,
            color: '#fde68a',
            fontSize: 13.5,
            lineHeight: 1.85,
          }}
        >
          <strong style={{ color: C.gold }}>هذه ليست شاشة «إعلام المستخدمين».</strong>
          <br />
          لإرسال رسالة كاملة — تُحفَظ في السجل، وتظهر داخل التطبيق، وتُرسَل بالإيميل، ومعها
          تقرير بمن وصلته ومن لم تصله ولماذا — استخدم{' '}
          <a
            href="/tareeq-admin/broadcasts"
            style={{ color: C.gold, fontWeight: 700, textDecoration: 'underline' }}
          >
            «📣 إعلام المستخدمين» في القائمة على اليمين
          </a>
          .
          <br />
          وما يُرسَل من هنا لا يُسجَّل في أي مكان، فلا يمكن تتبّعه بعد إرساله.
        </div>

        {/* Info banner */}
        <div
          style={{
            background: '#0c1a4d',
            border: '1px solid #3b82f666',
            borderRadius: 10,
            padding: '14px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <p style={{ color: '#93c5fd', fontSize: 13, margin: 0 }}>
            هذه الإشعارات تُرسل عبر Web Push مباشرةً إلى أجهزة المستخدمين الذين اشتركوا في
            الإشعارات. تأكد من أن المحتوى مناسب قبل الإرسال.
          </p>
        </div>

        <form
          onSubmit={handleSend}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Title */}
          <div>
            <label style={{ color: C.muted, fontSize: 13, display: 'block', marginBottom: 6 }}>
              العنوان (بالعربية) *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تحديث مهم للمنصة"
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                padding: '10px 14px',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ color: C.muted, fontSize: 13, display: 'block', marginBottom: 6 }}>
              المحتوى (بالعربية) *
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="نص الإشعار..."
              rows={4}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                padding: '10px 14px',
                fontSize: 14,
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* URL */}
          <div>
            <label style={{ color: C.muted, fontSize: 13, display: 'block', marginBottom: 6 }}>
              رابط (اختياري)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/tareeq/posts/..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                padding: '10px 14px',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {/* Target Type */}
          <div>
            <label style={{ color: C.muted, fontSize: 13, display: 'block', marginBottom: 8 }}>
              الجمهور المستهدف
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['all', 'user'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTargetType(type)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 8,
                    border: `1px solid ${targetType === type ? C.gold : C.border}`,
                    background: targetType === type ? '#451a03' : C.bg,
                    color: targetType === type ? C.gold : C.muted,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {type === 'all' ? '🌐 الكل' : '👤 مستخدم محدد'}
                </button>
              ))}
            </div>
          </div>

          {/* User search (when target=user) */}
          {targetType === 'user' && (
            <div>
              <label style={{ color: C.muted, fontSize: 13, display: 'block', marginBottom: 6 }}>
                معرّف المستخدم أو البريد الإلكتروني *
              </label>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="أدخل ID المستخدم أو البريد الإلكتروني"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  color: C.text,
                  padding: '10px 14px',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Preview */}
          {(title || body) && (
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '14px 18px',
              }}
            >
              <p style={{ color: C.muted, fontSize: 12, margin: '0 0 8px' }}>معاينة الإشعار:</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  🕌
                </div>
                <div>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>
                    {title || 'العنوان...'}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                    {body || 'المحتوى...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={sending}
            style={{
              background: sending ? C.border : C.gold,
              border: 'none',
              borderRadius: 10,
              color: sending ? C.muted : '#000',
              padding: '13px',
              fontWeight: 700,
              fontSize: 15,
              cursor: sending ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {sending ? 'جاري الإرسال...' : '📤 إرسال الإشعار'}
          </button>
        </form>

        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1e293b',
              border: `1px solid ${toastOk ? C.gold : '#ef4444'}`,
              color: C.text,
              borderRadius: 10,
              padding: '12px 24px',
              fontSize: 14,
              zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
