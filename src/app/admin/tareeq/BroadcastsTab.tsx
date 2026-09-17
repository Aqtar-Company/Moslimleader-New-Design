'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BROADCAST_AUDIENCES, BROADCAST_AUDIENCE_KEYS, BROADCAST_BODY_MAX, BROADCAST_KINDS, BROADCAST_KIND_KEYS,
  BROADCAST_LINK_LABEL_MAX, BROADCAST_SELECTED_MAX, BROADCAST_TITLE_MAX,
  type BroadcastAudience, type BroadcastKind,
} from '@/lib/admin-broadcast-shared';

/**
 * إعلام المستخدمين — the "📣 الرسائل" tab of /admin/tareeq.
 *
 * Two halves: a compose form (kind, title, body, optional link, audience with live reach,
 * channels, test send, save-as-draft, send) and the history with live progress while a
 * send runs, a per-recipient delivery report, resume/cancel, and "use as template".
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface Broadcast {
  id: string;
  kind: BroadcastKind;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  audience: BroadcastAudience;
  targetUserIds: string[] | null;
  channelInApp: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  serviceMessage: boolean;
  status: 'draft' | 'sending' | 'sent' | 'failed' | 'canceled';
  recipientCount: number;
  processedCount: number;
  inAppCount: number;
  pushCount: number;
  emailSentCount: number;
  emailFailedCount: number;
  error: string | null;
  createdByName: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface PickedUser { id: string; name: string; email: string; avatarUrl?: string | null }

interface Recipient {
  id: string;
  userId: string;
  email: string | null;
  status: 'queued' | 'done' | 'failed';
  inAppSent: boolean;
  pushSent: boolean;
  emailStatus: 'skipped' | 'queued' | 'sent' | 'failed';
  error: string | null;
  readAt: string | null;
  user: { name: string; avatarUrl: string | null };
}

interface Reach { total: number; withPush: number; emailOptIn: number }

type Form = {
  kind: BroadcastKind;
  title: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
  audience: BroadcastAudience;
  selected: PickedUser[];
  channelInApp: boolean;
  channelPush: boolean;
  channelEmail: boolean;
  serviceMessage: boolean;
};

const EMPTY_FORM: Form = {
  kind: 'announcement', title: '', body: '', linkUrl: '', linkLabel: '',
  audience: 'all', selected: [],
  channelInApp: true, channelPush: true, channelEmail: false, serviceMessage: false,
};

// ─── Styles (match the sibling tabs) ──────────────────────────────────────────

const S = {
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '16px 18px', marginBottom: 12 } as React.CSSProperties,
  input: { padding: '10px 14px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6 } as React.CSSProperties,
  btn: (color: string, text = '#0f172a'): React.CSSProperties => ({ padding: '9px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', background: color, color: text }),
  ghost: { padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: '1px solid #334155', cursor: 'pointer', background: 'transparent', color: '#cbd5e1' } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: color + '22', color }),
  hint: { fontSize: 12, color: '#64748b', marginTop: 6 } as React.CSSProperties,
};

const STATUS_AR: Record<Broadcast['status'], string> = { draft: 'مسودة', sending: 'قيد الإرسال', sent: 'أُرسلت', failed: 'فشلت', canceled: 'أُلغيت' };
const STATUS_COLOR: Record<Broadcast['status'], string> = { draft: '#94a3b8', sending: '#60a5fa', sent: '#22c55e', failed: '#ef4444', canceled: '#f59e0b' };

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BroadcastsTab({ flash }: { flash: (t: string) => void }) {
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'send' | 'test' | null>(null);
  const [err, setErr] = useState('');
  const [reach, setReach] = useState<Reach | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const [list, setList] = useState<Broadcast[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  // ── Reach: recomputed when the audience (or the picked list) changes, debounced.
  useEffect(() => {
    const ids = form.audience === 'selected' ? form.selected.map(u => u.id) : [];
    if (form.audience === 'selected' && ids.length === 0) { setReach({ total: 0, withPush: 0, emailOptIn: 0 }); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/tareeq/broadcasts/audience?audience=${form.audience}${ids.length ? `&ids=${ids.join(',')}` : ''}`);
        if (res.ok) setReach(await res.json());
      } catch { /* the number is advisory */ }
    }, 300);
    return () => clearTimeout(t);
  }, [form.audience, form.selected]);

  // ── History
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/admin/tareeq/broadcasts?page=${page}`);
      if (res.ok) { const d = await res.json(); setList(d.broadcasts); setTotal(d.total); }
    } finally { setLoadingList(false); }
  }, [page]);
  useEffect(() => { loadList(); }, [loadList]);

  // While anything is sending, poll every 3s so the progress bars move.
  const anySending = list.some(b => b.status === 'sending');
  useEffect(() => {
    if (!anySending) return;
    const t = setInterval(loadList, 3000);
    return () => clearInterval(t);
  }, [anySending, loadList]);

  // ── Compose payload
  const payload = () => ({
    kind: form.kind,
    title: form.title,
    body: form.body,
    linkUrl: form.linkUrl,
    linkLabel: form.linkLabel,
    audience: form.audience,
    targetUserIds: form.audience === 'selected' ? form.selected.map(u => u.id) : undefined,
    channelInApp: form.channelInApp,
    channelPush: form.channelPush,
    channelEmail: form.channelEmail,
    serviceMessage: form.serviceMessage,
  });

  /** Create or update the draft; returns its id. */
  async function persistDraft(): Promise<string | null> {
    const res = draftId
      ? await fetch(`/api/admin/tareeq/broadcasts/${draftId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) })
      : await fetch('/api/admin/tareeq/broadcasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload(), send: false }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || 'تعذّر الحفظ'); return null; }
    setDraftId(d.broadcast.id);
    return d.broadcast.id as string;
  }

  async function saveDraft() {
    setErr(''); setSaving('draft');
    const id = await persistDraft();
    setSaving(null);
    if (id) { flash('تم حفظ المسودة'); loadList(); }
  }

  async function sendTest() {
    setErr(''); setSaving('test');
    const id = await persistDraft();
    if (id) {
      const res = await fetch(`/api/admin/tareeq/broadcasts/${id}/test`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setErr(d.error || 'تعذّر الإرسال التجريبي');
      else flash(`أُرسلت نسخة تجريبية لك${d.email ? ' (شامل الإيميل)' : ''} ✓`);
    }
    setSaving(null);
  }

  async function send() {
    setConfirmSend(false);
    setErr(''); setSaving('send');
    const id = await persistDraft();
    if (id) {
      const res = await fetch(`/api/admin/tareeq/broadcasts/${id}/send`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setErr(d.error || 'تعذّر بدء الإرسال');
      else {
        flash(`بدأ الإرسال إلى ${d.queued} مستلم ✓`);
        setForm(EMPTY_FORM); setDraftId(null); setShowPreview(false);
        setPage(1); loadList();
        setOpenId(id);
      }
    }
    setSaving(null);
  }

  function useAsTemplate(b: Broadcast, targets: PickedUser[] = []) {
    setForm({
      kind: b.kind, title: b.title, body: b.body, linkUrl: b.linkUrl ?? '', linkLabel: b.linkLabel ?? '',
      audience: b.audience, selected: targets,
      channelInApp: b.channelInApp, channelPush: b.channelPush, channelEmail: b.channelEmail, serviceMessage: b.serviceMessage,
    });
    setDraftId(b.status === 'draft' ? b.id : null);
    setErr('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    flash(b.status === 'draft' ? 'المسودة مفتوحة للتعديل' : 'تم نسخ الرسالة إلى النموذج');
  }

  const canAct = !saving && form.title.trim() && form.body.trim() && (form.channelInApp || form.channelPush || form.channelEmail)
    && (form.audience !== 'selected' || form.selected.length > 0);

  const kind = BROADCAST_KINDS[form.kind];
  const emailReach = reach ? (form.serviceMessage ? reach.total : reach.emailOptIn) : null;

  return (
    <div>
      {/* ── Compose ─────────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>{draftId ? 'تعديل مسودة' : 'رسالة جديدة للمستخدمين'}</h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>تحديث، إعلان، تذكير أو ملاحظة — لكل الناس أو لأشخاص محددين، داخل طريق وبالإشعارات وبالإيميل.</p>
          </div>
          {draftId && (
            <button type="button" style={S.ghost} onClick={() => { setForm(EMPTY_FORM); setDraftId(null); setErr(''); }}>رسالة جديدة بدل المسودة</button>
          )}
        </div>

        {/* Kind */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {BROADCAST_KIND_KEYS.map(k => {
            const on = form.kind === k;
            return (
              <button key={k} type="button" onClick={() => { set('kind', k); if (k !== 'announcement') set('serviceMessage', true); else set('serviceMessage', false); }}
                style={{ padding: '8px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', border: `1px solid ${on ? '#d4a843' : '#334155'}`, background: on ? '#d4a84322' : '#0f172a', color: on ? '#d4a843' : '#94a3b8' }}>
                {BROADCAST_KINDS[k].icon} {BROADCAST_KINDS[k].ar}
              </button>
            );
          })}
        </div>

        {/* Title / body */}
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>العنوان <span style={{ color: '#64748b', fontWeight: 500 }}>({form.title.length}/{BROADCAST_TITLE_MAX})</span></label>
          <input style={S.input} maxLength={BROADCAST_TITLE_MAX} value={form.title} onChange={e => set('title', e.target.value)} placeholder={form.kind === 'reminder' ? 'مثال: تذكير — ختمة رمضان تبدأ الليلة' : 'مثال: تحديث جديد في طريق'} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>النص <span style={{ color: '#64748b', fontWeight: 500 }}>({form.body.length}/{BROADCAST_BODY_MAX})</span></label>
          <textarea style={{ ...S.input, minHeight: 140, lineHeight: 1.7, resize: 'vertical' }} maxLength={BROADCAST_BODY_MAX} value={form.body} onChange={e => set('body', e.target.value)}
            placeholder="اكتب الرسالة كما ستصل للناس. سطر فاضي = فقرة جديدة. يمكنك كتابة {{firstName}} ليُستبدل باسم المستلم في الإيميل." />
          <p style={S.hint}>الإشعار داخل طريق والـpush يعرضان أول 180–280 حرفاً، والنص الكامل يظهر في صفحة الرسالة وفي الإيميل.</p>
        </div>

        {/* Link */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={S.label}>رابط (اختياري)</label>
            <input style={S.input} value={form.linkUrl} onChange={e => set('linkUrl', e.target.value)} placeholder="https://… أو /tareeq/khatmati" dir="ltr" />
          </div>
          <div>
            <label style={S.label}>نص الزر</label>
            <input style={S.input} maxLength={BROADCAST_LINK_LABEL_MAX} value={form.linkLabel} onChange={e => set('linkLabel', e.target.value)} placeholder="افتح الرابط" disabled={!form.linkUrl.trim()} />
          </div>
        </div>

        {/* Audience */}
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>إلى من؟</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {BROADCAST_AUDIENCE_KEYS.map(a => {
              const on = form.audience === a;
              return (
                <button key={a} type="button" onClick={() => set('audience', a)}
                  style={{ textAlign: 'start', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${on ? '#d4a843' : '#334155'}`, background: on ? '#d4a84314' : '#0f172a', color: on ? '#f1f5f9' : '#94a3b8', fontWeight: 700, fontSize: 13 }}>
                  {BROADCAST_AUDIENCES[a].ar}
                </button>
              );
            })}
          </div>
          {form.audience === 'selected' && (
            <UserPicker selected={form.selected} onChange={v => set('selected', v)} />
          )}
          {reach && (
            <p style={{ ...S.hint, color: '#94a3b8' }}>
              سيصل إلى <b style={{ color: '#f1f5f9' }}>{reach.total}</b> شخص
              {' · '}منهم <b style={{ color: '#f1f5f9' }}>{reach.withPush}</b> لديهم إشعارات push مفعّلة
              {form.channelEmail && <> {' · '}الإيميل سيصل إلى <b style={{ color: '#f1f5f9' }}>{emailReach}</b></>}
            </p>
          )}
        </div>

        {/* Channels */}
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>القنوات</label>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Check label="داخل طريق (الجرس)" checked={form.channelInApp} onChange={v => set('channelInApp', v)} />
            <Check label="إشعار push على الجهاز" checked={form.channelPush} onChange={v => set('channelPush', v)} />
            <Check label="بريد إلكتروني" checked={form.channelEmail} onChange={v => set('channelEmail', v)} />
          </div>
          {form.channelEmail && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#0f172a', border: '1px solid #334155' }}>
              <Check label="رسالة خدمية — تصل حتى لمن ألغى اشتراك الرسائل التسويقية" checked={form.serviceMessage} onChange={v => set('serviceMessage', v)} />
              <p style={S.hint}>{form.serviceMessage
                ? 'مناسب للتحديثات والتذكيرات والملاحظات المهمة. لا يحمل رابط إلغاء اشتراك.'
                : 'مناسب للإعلانات الترويجية. يصل فقط لمن وافق على الرسائل التسويقية، ويحمل رابط إلغاء الاشتراك.'}
              </p>
              <p style={S.hint}>الإيميل يُرسل بمعدل ~30 رسالة في الدقيقة (حد Titan)؛ ألف مستلم ≈ 35 دقيقة في الخلفية، والموقع لا يتأثر.</p>
            </div>
          )}
          {!form.channelInApp && !form.channelPush && !form.channelEmail && <p style={{ ...S.hint, color: '#f87171' }}>اختر قناة واحدة على الأقل</p>}
        </div>

        {err && <div style={{ background: '#ef444422', color: '#fca5a5', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{err}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" disabled={!canAct} onClick={() => setConfirmSend(true)} style={{ ...S.btn('#d4a843'), opacity: canAct ? 1 : 0.5 }}>
            {saving === 'send' ? 'جارٍ البدء…' : `📣 إرسال الآن${reach ? ` إلى ${reach.total}` : ''}`}
          </button>
          <button type="button" disabled={!canAct} onClick={sendTest} style={{ ...S.ghost, opacity: canAct ? 1 : 0.5 }}>{saving === 'test' ? 'جارٍ الإرسال…' : '🧪 أرسل لي نسخة تجريبية'}</button>
          <button type="button" disabled={!!saving || !form.title.trim()} onClick={saveDraft} style={{ ...S.ghost, opacity: form.title.trim() ? 1 : 0.5 }}>{saving === 'draft' ? 'جارٍ الحفظ…' : '💾 حفظ كمسودة'}</button>
          <button type="button" onClick={() => setShowPreview(p => !p)} style={S.ghost}>{showPreview ? 'إخفاء المعاينة' : '👁 معاينة'}</button>
        </div>

        {showPreview && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
              <p style={{ ...S.label, marginBottom: 8 }}>كما يظهر في الجرس</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20 }}>{kind.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <span style={S.badge('#d4a843')}>{kind.ar}</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 800, color: '#f1f5f9', fontSize: 14 }}>{form.title || 'العنوان'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{form.body || 'نص الرسالة…'}</p>
                </div>
              </div>
            </div>
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
              <p style={{ ...S.label, marginBottom: 8 }}>إشعار push</p>
              <div style={{ background: '#1e293b', borderRadius: 12, padding: '10px 12px', border: '1px solid #334155' }}>
                <p style={{ margin: 0, fontWeight: 800, color: '#f1f5f9', fontSize: 13 }}>{kind.icon} {form.title || 'العنوان'}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#cbd5e1', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{form.body.slice(0, 180) || 'نص الرسالة…'}{form.body.length > 180 ? '…' : ''}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirm dialog ──────────────────────────────────────────── */}
      {confirmSend && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setConfirmSend(false)}>
          <div style={{ ...S.card, maxWidth: 440, width: '100%', marginBottom: 0 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#f1f5f9' }}>تأكيد الإرسال</h3>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.8, margin: '10px 0' }}>
              <b>{kind.icon} {form.title}</b><br />
              إلى: {BROADCAST_AUDIENCES[form.audience].ar}{form.audience === 'selected' ? ` (${form.selected.length})` : ''}<br />
              العدد: <b style={{ color: '#f1f5f9' }}>{reach?.total ?? '…'}</b> شخص<br />
              القنوات: {[form.channelInApp && 'داخل طريق', form.channelPush && 'push', form.channelEmail && `إيميل (${emailReach ?? '…'})`].filter(Boolean).join(' · ')}
            </p>
            <p style={{ fontSize: 12, color: '#f59e0b', margin: '0 0 12px' }}>لا يمكن التراجع عن الرسائل التي وصلت. يمكنك إيقاف الإرسال في منتصفه من السجل.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={S.ghost} onClick={() => setConfirmSend(false)}>رجوع</button>
              <button type="button" style={S.btn('#d4a843')} onClick={send}>نعم، أرسل</button>
            </div>
          </div>
        </div>
      )}

      {/* ── History ─────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', margin: '24px 0 10px' }}>السجل <span style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>({total})</span></h2>
      {loadingList && list.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>جارٍ التحميل…</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>لم تُرسل أي رسالة بعد.</p>
      ) : list.map(b => (
        <BroadcastRow key={b.id} b={b} open={openId === b.id} onToggle={() => setOpenId(openId === b.id ? null : b.id)} onChanged={loadList} onTemplate={useAsTemplate} flash={flash} />
      ))}
      {total > 20 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
          <button type="button" style={S.ghost} disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</button>
          <span style={{ color: '#94a3b8', fontSize: 13, alignSelf: 'center' }}>{page} / {Math.ceil(total / 20)}</span>
          <button type="button" style={S.ghost} disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>التالي</button>
        </div>
      )}
    </div>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1', cursor: 'pointer', fontWeight: 700 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#d4a843' }} />
      {label}
    </label>
  );
}

/** Search-and-pick members for the "selected people" audience. */
function UserPicker({ selected, onChange }: { selected: PickedUser[]; onChange: (v: PickedUser[]) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const my = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/tareeq/users?q=${encodeURIComponent(term)}`);
        if (!res.ok || my !== seq.current) return;
        const d = await res.json();
        setResults((d.users as PickedUser[]).filter(u => !selected.some(s => s.id === u.id)).slice(0, 8));
      } finally { if (my === seq.current) setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, selected]);

  const full = selected.length >= BROADCAST_SELECTED_MAX;
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: '#0f172a', border: '1px solid #334155' }}>
      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {selected.map(u => (
            <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 10px', borderRadius: 20, background: '#1e293b', border: '1px solid #334155', fontSize: 12, color: '#f1f5f9', fontWeight: 700 }}>
              {u.name}
              <button type="button" aria-label={`إزالة ${u.name}`} onClick={() => onChange(selected.filter(s => s.id !== u.id))} style={{ border: 'none', background: '#334155', color: '#cbd5e1', width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', fontSize: 11, lineHeight: 1 }}>✕</button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} style={{ ...S.ghost, padding: '4px 10px', fontSize: 12 }}>مسح الكل</button>
        </div>
      )}
      <input style={S.input} value={q} onChange={e => setQ(e.target.value)} placeholder={full ? `الحد الأقصى ${BROADCAST_SELECTED_MAX}` : 'ابحث بالاسم أو الإيميل ثم اختر…'} disabled={full} />
      {searching && <p style={S.hint}>جارٍ البحث…</p>}
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map(u => (
            <li key={u.id}>
              <button type="button" onClick={() => { onChange([...selected, u]); setQ(''); setResults([]); }}
                style={{ width: '100%', textAlign: 'start', padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{u.name}</span>
                <span style={{ color: '#94a3b8', fontSize: 12 }} dir="ltr">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p style={S.hint}>{selected.length} مستلم محدد · الحد الأقصى {BROADCAST_SELECTED_MAX} — لأكثر من ذلك استخدم جمهوراً عاماً.</p>
    </div>
  );
}

function BroadcastRow({ b, open, onToggle, onChanged, onTemplate, flash }: {
  b: Broadcast; open: boolean; onToggle: () => void; onChanged: () => void;
  onTemplate: (b: Broadcast, targets?: PickedUser[]) => void; flash: (t: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const kind = BROADCAST_KINDS[b.kind] ?? { icon: '📣', ar: b.kind };
  const pct = b.recipientCount ? Math.round((b.processedCount / b.recipientCount) * 100) : 0;
  const channels = [b.channelInApp && 'طريق', b.channelPush && 'push', b.channelEmail && 'إيميل'].filter(Boolean).join(' · ');

  async function act(path: 'send' | 'cancel', label: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/tareeq/broadcasts/${b.id}/${path}`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { flash(label); onChanged(); } else flash(d.error || 'حدث خطأ');
  }
  async function remove() {
    if (!confirm(`حذف «${b.title}»؟ ${b.status === 'draft' ? '' : 'الإشعارات التي وصلت للناس تبقى عندهم.'}`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/tareeq/broadcasts/${b.id}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { flash('تم الحذف'); onChanged(); } else flash(d.error || 'حدث خطأ');
  }

  return (
    <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
      <button type="button" onClick={onToggle} style={{ width: '100%', textAlign: 'start', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>{kind.icon}</span>
          <span style={{ fontWeight: 900, color: '#f1f5f9', fontSize: 14, flex: 1, minWidth: 160 }}>{b.title}</span>
          <span style={S.badge(STATUS_COLOR[b.status])}>{STATUS_AR[b.status]}</span>
          <span style={S.badge('#94a3b8')}>{BROADCAST_AUDIENCES[b.audience]?.ar ?? b.audience}{b.audience === 'selected' && b.targetUserIds ? ` (${b.targetUserIds.length})` : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
          <span>{fmtDate(b.startedAt ?? b.createdAt)}</span>
          <span>{channels}</span>
          {b.status !== 'draft' && <span>{b.processedCount}/{b.recipientCount} مستلم</span>}
          {b.channelInApp && b.status !== 'draft' && <span>🔔 {b.inAppCount}</span>}
          {b.channelPush && b.status !== 'draft' && <span>📲 {b.pushCount}</span>}
          {b.channelEmail && b.status !== 'draft' && <span>✉️ {b.emailSentCount}{b.emailFailedCount ? <span style={{ color: '#f87171' }}> / فشل {b.emailFailedCount}</span> : null}</span>}
          {b.createdByName && <span>بواسطة {b.createdByName}</span>}
        </div>
        {b.status === 'sending' && (
          <div dir="ltr" style={{ marginTop: 10, height: 6, borderRadius: 3, background: '#0f172a', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#60a5fa', transition: 'width .6s' }} />
          </div>
        )}
        {b.error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#fca5a5' }}>{b.error}</p>}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #334155', padding: '14px 16px' }}>
          <p style={{ whiteSpace: 'pre-line', color: '#cbd5e1', fontSize: 13, lineHeight: 1.8, margin: '0 0 10px', maxHeight: 200, overflow: 'auto' }}>{b.body}</p>
          {b.linkUrl && <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>🔗 <span dir="ltr">{b.linkUrl}</span>{b.linkLabel ? ` — «${b.linkLabel}»` : ''}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {b.status === 'draft' && <button type="button" style={S.btn('#d4a843')} disabled={busy} onClick={() => onTemplate(b)}>✏️ تعديل المسودة</button>}
            {b.status === 'draft' && <button type="button" style={S.ghost} disabled={busy} onClick={() => act('send', 'بدأ الإرسال ✓')}>📣 إرسال</button>}
            {b.status === 'sending' && <button type="button" style={S.btn('#f59e0b')} disabled={busy} onClick={() => act('cancel', 'تم إيقاف الإرسال')}>⏸ إيقاف الإرسال</button>}
            {(b.status === 'canceled' || b.status === 'failed') && b.processedCount < b.recipientCount && <button type="button" style={S.btn('#60a5fa')} disabled={busy} onClick={() => act('send', 'استُكمل الإرسال ✓')}>▶ استكمال الإرسال للباقين</button>}
            {b.status !== 'draft' && <TemplateButton b={b} onTemplate={onTemplate} />}
            {b.status !== 'sending' && <button type="button" style={{ ...S.ghost, color: '#f87171', borderColor: '#7f1d1d' }} disabled={busy} onClick={remove}>🗑 حذف</button>}
          </div>
          {b.status !== 'draft' && <RecipientsReport id={b.id} channelEmail={b.channelEmail} />}
        </div>
      )}
    </div>
  );
}

/** "Use as template" — for a hand-picked audience it first fetches the names of the list. */
function TemplateButton({ b, onTemplate }: { b: Broadcast; onTemplate: (b: Broadcast, targets?: PickedUser[]) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" style={S.ghost} disabled={busy} onClick={async () => {
      if (b.audience !== 'selected') { onTemplate(b); return; }
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/tareeq/broadcasts/${b.id}?recipients=all&page=1`);
        const d = res.ok ? await res.json() : { targets: [] };
        onTemplate(b, d.targets ?? []);
      } finally { setBusy(false); }
    }}>📋 استخدم كقالب</button>
  );
}

function RecipientsReport({ id, channelEmail }: { id: string; channelEmail: boolean }) {
  const [filter, setFilter] = useState<'all' | 'failed' | 'queued'>('all');
  const [rows, setRows] = useState<Recipient[]>([]);
  const [total, setTotal] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/tareeq/broadcasts/${id}?recipients=${filter}&page=${page}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) { setRows(d.recipients); setTotal(d.total); setReadCount(d.readCount); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, filter, page]);

  const pages = Math.max(1, Math.ceil(total / 50));
  const emailLabel = useMemo(() => ({ skipped: '—', queued: '⏳', sent: '✓', failed: '✗' } as Record<string, string>), []);

  return (
    <div style={{ background: '#0f172a', borderRadius: 10, border: '1px solid #334155', padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>تقرير التسليم</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>· قرأها {readCount} شخص</span>
        <span style={{ flex: 1 }} />
        {(['all', 'failed', 'queued'] as const).map(f => (
          <button key={f} type="button" onClick={() => { setFilter(f); setPage(1); }}
            style={{ ...S.ghost, padding: '4px 10px', fontSize: 12, borderColor: filter === f ? '#d4a843' : '#334155', color: filter === f ? '#d4a843' : '#cbd5e1' }}>
            {f === 'all' ? 'الكل' : f === 'failed' ? 'الفاشلة' : 'المتبقية'}
          </button>
        ))}
      </div>
      {loading ? <p style={S.hint}>جارٍ التحميل…</p> : rows.length === 0 ? <p style={S.hint}>لا يوجد</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'start' }}>
                <th style={{ padding: '4px 6px', textAlign: 'start' }}>المستلم</th>
                <th style={{ padding: '4px 6px' }}>طريق</th>
                <th style={{ padding: '4px 6px' }}>push</th>
                {channelEmail && <th style={{ padding: '4px 6px' }}>إيميل</th>}
                <th style={{ padding: '4px 6px' }}>قرأها</th>
                <th style={{ padding: '4px 6px', textAlign: 'start' }}>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #1e293b', color: '#cbd5e1' }}>
                  <td style={{ padding: '6px', textAlign: 'start' }}>
                    <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{r.user.name}</span>
                    <span style={{ color: '#64748b', marginInlineStart: 6 }} dir="ltr">{r.email}</span>
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{r.status === 'queued' ? '⏳' : r.inAppSent ? '✓' : '—'}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{r.status === 'queued' ? '⏳' : r.pushSent ? '✓' : '—'}</td>
                  {channelEmail && <td style={{ padding: '6px', textAlign: 'center', color: r.emailStatus === 'failed' ? '#f87171' : undefined }}>{emailLabel[r.emailStatus] ?? r.emailStatus}</td>}
                  <td style={{ padding: '6px', textAlign: 'center' }}>{r.readAt ? '👁' : ''}</td>
                  <td style={{ padding: '6px', textAlign: 'start', color: '#fca5a5' }}>{r.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <button type="button" style={{ ...S.ghost, padding: '4px 10px', fontSize: 12 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>السابق</button>
          <span style={{ color: '#94a3b8', fontSize: 12, alignSelf: 'center' }}>{page} / {pages}</span>
          <button type="button" style={{ ...S.ghost, padding: '4px 10px', fontSize: 12 }} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>التالي</button>
        </div>
      )}
      <p style={S.hint}>«—» في عمود طريق أو push يعني أن الشخص أوقف «إعلانات المنصة» من إعداداته، أو لا يملك جهازاً مفعّلاً للـpush.</p>
    </div>
  );
}
