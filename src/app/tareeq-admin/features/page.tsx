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

const CRITICAL_KEYS = ['calls_enabled', 'registrations_enabled', 'app_enabled'];

interface Feature {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      aria-pressed={enabled}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 52,
        height: 28,
        borderRadius: 999,
        background: enabled ? '#f59e0b' : '#334155',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
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
          transform: enabled ? 'translateX(28px)' : 'translateX(4px)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

interface WarningModalProps {
  feature: Feature;
  onConfirm: () => void;
  onCancel: () => void;
}

function WarningModal({ feature, onConfirm, onCancel }: WarningModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid #ef4444`,
          borderRadius: 14,
          padding: 32,
          maxWidth: 440,
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#fca5a5', fontSize: 18, fontWeight: 700, textAlign: 'center', margin: '0 0 12px' }}>
          تحذير: ميزة حرجة
        </h2>
        <p style={{ color: C.muted, textAlign: 'center', fontSize: 14, marginBottom: 24 }}>
          أنت على وشك تعطيل <strong style={{ color: C.text }}>{feature.label}</strong>. قد يؤثر
          هذا على جميع مستخدمي المنصة. هل أنت متأكد؟
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              background: C.border,
              border: 'none',
              borderRadius: 8,
              color: C.text,
              padding: '10px 24px',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              padding: '10px 24px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            تعطيل على أي حال
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [warningFeature, setWarningFeature] = useState<Feature | null>(null);

  useEffect(() => {
    fetch('/api/tareeq-admin/features', { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/tareeq-admin/login');
          return;
        }
        const json = await res.json();
        setFeatures(json.features ?? []);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleToggle = async (feature: Feature, newValue: boolean) => {
    // Warn before disabling critical features
    if (!newValue && CRITICAL_KEYS.includes(feature.key)) {
      setWarningFeature({ ...feature, enabled: newValue });
      return;
    }
    await doToggle(feature.key, newValue);
  };

  const doToggle = async (key: string, enabled: boolean) => {
    setSaving(key);
    try {
      const res = await fetch('/api/tareeq-admin/features', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      });
      if (res.status === 401) {
        router.push('/tareeq-admin/login');
        return;
      }
      if (!res.ok) throw new Error('فشل الحفظ');
      const json = await res.json();
      setFeatures((prev) => prev.map((f) => (f.key === key ? json.feature : f)));
      showToast(enabled ? `تم تفعيل "${key}"` : `تم تعطيل "${key}"`);
    } catch {
      showToast('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(null);
    }
  };

  return (
    <AdminShell>
      <div dir="rtl" style={{ padding: '32px 24px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: 0 }}>
            🎛️ إعدادات الميزات
          </h1>
          <p style={{ color: C.muted, marginTop: 6, fontSize: 14 }}>
            تفعيل وتعطيل ميزات المنصة في الوقت الفعلي
          </p>
        </div>

        {loading && (
          <div style={{ color: C.muted, textAlign: 'center', padding: 60 }}>جاري التحميل...</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {features.map((f) => {
            const isCritical = CRITICAL_KEYS.includes(f.key);
            return (
              <div
                key={f.id}
                style={{
                  background: C.surface,
                  border: `1px solid ${isCritical ? '#f59e0b44' : C.border}`,
                  borderRadius: 12,
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{f.label}</span>
                    {isCritical && (
                      <span
                        style={{
                          background: '#451a03',
                          color: '#fcd34d',
                          borderRadius: 999,
                          padding: '1px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        حرجة
                      </span>
                    )}
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
                      {f.key}
                    </code>
                  </div>
                  {f.description && (
                    <p style={{ color: C.muted, fontSize: 13, margin: '0 0 6px' }}>
                      {f.description}
                    </p>
                  )}
                  <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
                    آخر تحديث: {new Date(f.updatedAt).toLocaleDateString('ar-EG')}
                    {f.updatedBy && ` · بواسطة ${f.updatedBy}`}
                  </p>
                </div>
                <Toggle
                  enabled={f.enabled}
                  disabled={saving === f.key}
                  onChange={(v) => handleToggle(f, v)}
                />
              </div>
            );
          })}
        </div>

        {/* Warning modal */}
        {warningFeature && (
          <WarningModal
            feature={warningFeature}
            onCancel={() => setWarningFeature(null)}
            onConfirm={async () => {
              const key = warningFeature.key;
              setWarningFeature(null);
              await doToggle(key, false);
            }}
          />
        )}

        {/* Toast */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#1e293b',
              border: `1px solid ${C.gold}`,
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
