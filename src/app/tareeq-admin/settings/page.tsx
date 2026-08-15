'use client';

import { useEffect, useState } from 'react';
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

interface Setting {
  id: string;
  key: string;
  value: string;
  label: string;
  description: string | null;
  type: string;
  updatedBy: string | null;
  updatedAt: string;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 52,
        height: 28,
        borderRadius: 999,
        background: checked ? C.gold : '#334155',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'transform 0.2s',
          transform: checked ? 'translateX(28px)' : 'translateX(4px)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

function SettingRow({
  setting,
  onSave,
  saving,
}: {
  setting: Setting;
  onSave: (key: string, value: string) => Promise<void>;
  saving: boolean;
}) {
  const [localValue, setLocalValue] = useState(setting.value);
  const dirty = localValue !== setting.value;

  const handleToggle = (v: boolean) => {
    const str = v ? 'true' : 'false';
    setLocalValue(str);
    onSave(setting.key, str);
  };

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '18px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{setting.label}</span>
            <code
              style={{
                background: C.bg,
                color: C.muted,
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {setting.key}
            </code>
            <span
              style={{
                background: '#0c1a4d',
                color: '#93c5fd',
                borderRadius: 999,
                padding: '1px 8px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {setting.type}
            </span>
          </div>
          {setting.description && (
            <p style={{ color: C.muted, fontSize: 13, margin: '0 0 4px' }}>
              {setting.description}
            </p>
          )}
          <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
            آخر تحديث: {new Date(setting.updatedAt).toLocaleDateString('ar-EG')}
            {setting.updatedBy && ` · بواسطة ${setting.updatedBy}`}
          </p>
        </div>

        {/* Boolean toggle */}
        {setting.type === 'boolean' && (
          <Toggle
            checked={localValue === 'true'}
            onChange={handleToggle}
          />
        )}
      </div>

      {/* Input based on type */}
      {setting.type === 'number' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            style={{
              flex: 1,
              background: C.bg,
              border: `1px solid ${dirty ? C.gold : C.border}`,
              borderRadius: 8,
              color: C.text,
              padding: '8px 12px',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {dirty && (
            <button
              onClick={() => onSave(setting.key, localValue)}
              disabled={saving}
              style={{
                background: C.gold,
                border: 'none',
                borderRadius: 8,
                color: '#000',
                padding: '8px 18px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {saving ? '...' : 'حفظ'}
            </button>
          )}
        </div>
      )}

      {setting.type === 'string' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            style={{
              flex: 1,
              background: C.bg,
              border: `1px solid ${dirty ? C.gold : C.border}`,
              borderRadius: 8,
              color: C.text,
              padding: '8px 12px',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {dirty && (
            <button
              onClick={() => onSave(setting.key, localValue)}
              disabled={saving}
              style={{
                background: C.gold,
                border: 'none',
                borderRadius: 8,
                color: '#000',
                padding: '8px 18px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
              }}
            >
              {saving ? '...' : 'حفظ'}
            </button>
          )}
        </div>
      )}

      {setting.type === 'json' && (
        <div>
          <textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: C.bg,
              border: `1px solid ${dirty ? C.gold : C.border}`,
              borderRadius: 8,
              color: '#7dd3fc',
              padding: '10px 14px',
              fontSize: 12,
              fontFamily: 'monospace',
              outline: 'none',
              resize: 'vertical',
            }}
          />
          {dirty && (
            <button
              onClick={() => {
                try {
                  JSON.parse(localValue); // validate
                  onSave(setting.key, localValue);
                } catch {
                  alert('JSON غير صالح');
                }
              }}
              disabled={saving}
              style={{
                background: C.gold,
                border: 'none',
                borderRadius: 8,
                color: '#000',
                padding: '8px 18px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
                marginTop: 8,
              }}
            >
              {saving ? '...' : 'حفظ'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastColor, setToastColor] = useState(C.gold);

  useEffect(() => {
    fetch('/api/tareeq-admin/settings', { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/tareeq-admin/login');
          return;
        }
        const json = await res.json();
        setSettings(json.settings ?? []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const showToast = (msg: string, color = C.gold) => {
    setToast(msg);
    setToastColor(color);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSave = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      const res = await fetch('/api/tareeq-admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.status === 401) {
        router.push('/tareeq-admin/login');
        return;
      }
      if (!res.ok) throw new Error('فشل');
      const json = await res.json();
      setSettings((prev) => prev.map((s) => (s.key === key ? json.setting : s)));
      showToast(`تم حفظ "${key}" بنجاح`);
    } catch {
      showToast('حدث خطأ أثناء الحفظ', '#ef4444');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <AdminShell>
      <div dir="rtl" style={{ padding: '32px 24px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: 0 }}>
            ⚙️ إعدادات المنصة
          </h1>
          <p style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
            تحكم في إعدادات المنصة العامة
          </p>
        </div>

        {loading && (
          <div style={{ color: C.muted, textAlign: 'center', padding: 60 }}>جاري التحميل...</div>
        )}

        {!loading && settings.length === 0 && (
          <div style={{ color: C.muted, textAlign: 'center', padding: 60 }}>
            لا توجد إعدادات محددة
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {settings.map((s) => (
            <SettingRow
              key={s.id}
              setting={s}
              saving={savingKey === s.key}
              onSave={handleSave}
            />
          ))}
        </div>

        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1e293b',
              border: `1px solid ${toastColor}`,
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
