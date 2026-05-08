'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

type AiProvider = 'openai' | 'gemini' | 'anthropic';

// Static catalogue of providers — mirrors AI_PROVIDERS in the lib.
// Kept here as well so the UI doesn't need a separate fetch just
// to render the dropdowns.
const PROVIDER_INFO: Record<AiProvider, { label: string; help: string; getKeyUrl: string; defaultModel: string; models: Array<{ id: string; label: string }> }> = {
  gemini: {
    label: 'Google Gemini',
    help: 'مجاني — 15 طلب/دقيقة + مليون token/يوم',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-1.5-flash',
    models: [
      { id: 'gemini-1.5-flash',     label: 'gemini-1.5-flash (مجاني، أسرع)' },
      { id: 'gemini-1.5-flash-8b',  label: 'gemini-1.5-flash-8b (مجاني، الأرخص)' },
      { id: 'gemini-1.5-pro',       label: 'gemini-1.5-pro (أفضل جودة)' },
      { id: 'gemini-2.0-flash-exp', label: 'gemini-2.0-flash-exp (تجريبي)' },
    ],
  },
  openai: {
    label: 'OpenAI ChatGPT',
    help: 'مدفوع — gpt-4o-mini ≈ $0.0008 لكل رد',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini',  label: 'gpt-4o-mini (الأرخص)' },
      { id: 'gpt-4o',       label: 'gpt-4o (أفضل جودة)' },
      { id: 'gpt-4-turbo',  label: 'gpt-4-turbo' },
      { id: 'gpt-3.5-turbo',label: 'gpt-3.5-turbo' },
    ],
  },
  anthropic: {
    label: 'Anthropic Claude',
    help: 'مدفوع — أفضل في العربية',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-haiku-4-5-20251001',
    models: [
      { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5 (سريع وأرخص)' },
      { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 (أعلى جودة)' },
      { id: 'claude-opus-4-7',            label: 'Claude Opus 4.7 (الأقوى)' },
    ],
  },
};

interface Settings {
  enabled: boolean;
  systemPrompt: string;
  provider: AiProvider;
  model: string;
  // GET returns booleans (existence), PUT accepts strings.
  apiKeys: { openai: boolean; gemini: boolean; anthropic: boolean };
  triggerKeywords: string[];
  maxTokens: number;
  updatedAt: string;
}

interface ConversationEvent {
  id: string;
  kind: 'message' | 'comment' | 'postback' | string;
  direction: 'incoming' | 'outgoing-auto' | 'outgoing-manual' | string;
  text: string;
  commentId: string | null;
  postId: string | null;
  aiModel: string | null;
  sendStatus: string | null;
  sendError: string | null;
  leadStatus: 'hot' | 'warm' | 'cold' | null;
  createdAt: string;
}

interface ConversationProfile {
  name: string | null;
  phone: string | null;
  address: string | null;
  governorate: string | null;
  kidAges: number[];
  lastIntent: string | null;
}

interface Conversation {
  key: string;
  kind: 'message' | 'comment' | 'postback' | string;
  psid: string;
  userName: string | null;
  userGender: 'male' | 'female' | 'unknown' | null;
  lastAt: string;
  eventCount: number;
  leadStatus: 'hot' | 'warm' | 'cold' | null;
  commentId: string | null;
  postId: string | null;
  muted: boolean;
  needsAttention: boolean;
  profile: ConversationProfile;
  events: ConversationEvent[];
}

const LEAD_BADGE: Record<string, { icon: string; label: string; cls: string }> = {
  hot:  { icon: '🔥', label: 'جاهز للشراء', cls: 'bg-red-100 text-red-700 border-red-200' },
  warm: { icon: '🟡', label: 'مهتم',       cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  cold: { icon: '⚪', label: 'استفسار',    cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

interface IntegrationStatus {
  hasOpenAiKey: boolean;
  hasGeminiKey: boolean;
  hasAnthropicKey: boolean;
  hasPageToken: boolean;
  hasAppSecret: boolean;
}

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('ar-EG', { hour12: false });

export default function AIFacebookAssistantPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<{ settings: Settings; conversations: Conversation[]; integrationStatus: IntegrationStatus } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Settings form
  const [enabled, setEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [model, setModel] = useState('gemini-1.5-flash');
  const [maxTokens, setMaxTokens] = useState(300);
  const [triggerKeywordsRaw, setTriggerKeywordsRaw] = useState('');
  const [saving, setSaving] = useState(false);
  // Per-provider key inputs. Empty string = "leave existing key as
  // is". The save handler only sends a non-empty string when the
  // admin actually typed something.
  const [keyInputs, setKeyInputs] = useState<Record<AiProvider, string>>({
    openai: '', gemini: '', anthropic: '',
  });

  // Test message
  const [testMessage, setTestMessage] = useState('السلام عليكم، عاوز أعرف أحدث الكتب');
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Knowledge base — live context the bot uses + admin-curated FAQs.
  const [kbStats, setKbStats] = useState<null | {
    productCount: number; bookCount: number; seriesCount: number;
    shippingZoneCount: number; couponCount: number; faqCount: number;
    builtAt: string; approxChars: number;
  }>(null);
  const [kbPreview, setKbPreview] = useState('');
  const [kbPreviewOpen, setKbPreviewOpen] = useState(false);
  const [faqs, setFaqs] = useState('');
  const [savingFaqs, setSavingFaqs] = useState(false);

  const loadKnowledge = async () => {
    try {
      const res = await adminFetch('/api/admin/ai-facebook-assistant/knowledge');
      if (!res.ok) return;
      const d = await res.json();
      setKbStats(d.context?.stats ?? null);
      setKbPreview(d.context?.text ?? '');
      setFaqs(d.faqs ?? '');
    } catch { /* ignore */ }
  };

  const saveFaqs = async () => {
    setSavingFaqs(true);
    try {
      const res = await adminFetch('/api/admin/ai-facebook-assistant/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); setSavingFaqs(false); return; }
      addToast('تم تحديث المعرفة الإضافية', 'success');
      loadKnowledge();
    } catch { addToast('فشل الحفظ', 'error'); }
    setSavingFaqs(false);
  };

  // Manual reply — tracks the active conversation by its compound key
  // (kind + psid) since one user can have BOTH a message thread and a
  // comment thread.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [manualReply, setManualReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'message' | 'comment'>('all');
  const [leadFilter, setLeadFilter] = useState<'all' | 'hot' | 'warm'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/ai-facebook-assistant');
      if (!res.ok) {
        // Surface the actual status / error body so a deploy issue
        // doesn't hide behind a generic "load failed" toast.
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200) || 'no body'}`);
      }
      const d = await res.json();
      setData(d);
      setEnabled(d.settings.enabled);
      setSystemPrompt(d.settings.systemPrompt ?? '');
      setProvider(d.settings.provider ?? 'gemini');
      setModel(d.settings.model ?? 'gemini-1.5-flash');
      setMaxTokens(d.settings.maxTokens ?? 300);
      setTriggerKeywordsRaw((d.settings.triggerKeywords ?? []).join(', '));
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else {
        const msg = err instanceof Error ? err.message : 'فشل التحميل';
        addToast(`فشل التحميل: ${msg}`, 'error', 8000);
        // eslint-disable-next-line no-console
        console.error('[ai-facebook-assistant] load failed', err);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); loadKnowledge(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const triggerKeywords = triggerKeywordsRaw
        .split(/[,،]/g)
        .map(s => s.trim())
        .filter(Boolean);
      // Only send key fields the user actually filled in. Empty
      // strings mean "no change" — the server treats them that way.
      const apiKeys: Record<string, string> = {};
      for (const k of ['openai', 'gemini', 'anthropic'] as const) {
        if (keyInputs[k] && keyInputs[k].trim()) apiKeys[k] = keyInputs[k].trim();
      }
      const res = await adminFetch('/api/admin/ai-facebook-assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, systemPrompt, provider, model, maxTokens, triggerKeywords, apiKeys }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); setSaving(false); return; }
      addToast('تم الحفظ', 'success');
      // Clear key inputs after save — keys are now persisted; the
      // "مفتاح مُهيّأ" badge confirms it.
      setKeyInputs({ openai: '', gemini: '', anthropic: '' });
      load();
    } catch { addToast('فشل الحفظ', 'error'); }
    setSaving(false);
  };

  const runTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true); setTestReply(null);
    try {
      const res = await adminFetch('/api/admin/ai-facebook-assistant/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الاختبار', 'error'); setTesting(false); return; }
      setTestReply(d.reply);
    } catch { addToast('فشل الاختبار', 'error'); }
    setTesting(false);
  };

  const sendManual = async () => {
    if (!activeConversation || !manualReply.trim()) return;
    setSending(true);
    try {
      const res = await adminFetch('/api/admin/ai-facebook-assistant/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psid: activeConversation.psid,
          text: manualReply,
          // Comment thread → reply via Graph API on the comment id.
          // Message thread → reply via Send API on the psid.
          commentId: activeConversation.kind === 'comment' ? activeConversation.commentId : undefined,
          postId: activeConversation.kind === 'comment' ? activeConversation.postId : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الإرسال', 'error'); setSending(false); return; }
      addToast('تم الإرسال', 'success');
      setManualReply('');
      load();
    } catch { addToast('فشل الإرسال', 'error'); }
    setSending(false);
  };

  const activeConversation = useMemo(
    () => data?.conversations.find(c => c.key === activeKey) ?? null,
    [data, activeKey],
  );

  const filteredConversations = useMemo(() => {
    if (!data) return [];
    let out = data.conversations;
    if (filter !== 'all') out = out.filter(c => c.kind === filter);
    if (leadFilter !== 'all') out = out.filter(c => c.leadStatus === leadFilter);
    return out;
  }, [data, filter, leadFilter]);

  if (forbidden) return <ForbiddenState requiredPerm="settings.read" />;
  if (loading || !data) return <Spinner />;

  const status = data.integrationStatus;
  const hasAiKey =
    provider === 'openai'    ? status.hasOpenAiKey :
    provider === 'anthropic' ? status.hasAnthropicKey :
                               status.hasGeminiKey;
  const allReady = hasAiKey && status.hasPageToken && status.hasAppSecret;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Hero */}
      <div className="bg-gradient-to-l from-blue-700 via-indigo-700 to-[#1a1a2e] rounded-2xl p-4 sm:p-6 text-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-black flex items-center gap-2">🤖 المساعد الذكي لفيسبوك</h1>
            <p className="text-white/85 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              المساعد بيرد تلقائياً على رسائل Messenger لصفحة Moslim Leader باستخدام OpenAI.
              من هنا تتحكم في تشغيله، شخصيته، وتشوف كل المحادثات.
            </p>
            <p className="text-[#F5C518]/90 text-[11px] mt-2">
              💡 محتاج تغيّر سلوك البوت؟ عدّل الـ "system prompt" أسفل، اضغط حفظ، وكل الردود التالية هتتبع الشخصية الجديدة.
            </p>
          </div>
          <div className={`shrink-0 rounded-xl px-4 py-3 border ${enabled ? 'bg-emerald-500/15 border-emerald-300/30' : 'bg-white/10 border-white/20'}`}>
            <p className="text-[10px] text-white/70 font-bold tracking-widest">الحالة</p>
            <p className={`text-2xl font-black mt-1 ${enabled ? 'text-emerald-300' : 'text-white/70'}`}>
              {enabled ? '🟢 نشط' : '⚪ متوقف'}
            </p>
          </div>
        </div>

        {/* Integration status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-5">
          <StatusBadge label="Gemini" ok={status.hasGeminiKey} hint="مجاني" />
          <StatusBadge label="ChatGPT" ok={status.hasOpenAiKey} hint="مدفوع" />
          <StatusBadge label="Claude" ok={status.hasAnthropicKey} hint="مدفوع" />
          <StatusBadge label="FB_PAGE_TOKEN" ok={status.hasPageToken} />
          <StatusBadge label="FB_APP_SECRET" ok={status.hasAppSecret} />
        </div>
        {!allReady && (
          <p className="text-[11px] text-amber-200 mt-3 leading-relaxed">
            ⚠️ بعض المتغيرات ناقصة في <code className="bg-white/10 px-1 rounded">.env</code> — البوت مش هيشتغل لحد ما تكمّلها وتعمل <code className="bg-white/10 px-1 rounded">pm2 restart all --update-env</code>.
          </p>
        )}
      </div>

      {/* Settings form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-black text-gray-900">⚙️ الإعدادات</h2>
          <span className="text-[10px] text-gray-500">آخر تعديل: {fmtDateTime(data.settings.updatedAt)}</span>
        </div>

        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="w-5 h-5"
          />
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">تشغيل الرد التلقائي</p>
            <p className="text-[11px] text-gray-500">لو متوقف، الرسائل تتسجّل في الـ inbox بس بدون أي رد</p>
          </div>
        </label>

        <Field label="شخصية البوت (System Prompt)" hint="الكلام ده مش بيظهر للعميل، لكن البوت بيلتزم بيه في كل رد. عدّله بحرية.">
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={12}
            dir="rtl"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
          />
          <p className="text-[10px] text-gray-400 mt-1">{systemPrompt.length} حرف</p>
        </Field>

        {/* API Keys — per provider. Stored in DB so the owner can
            manage them without SSH. Empty input = "no change". */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-black text-amber-900">🔑 مفاتيح API للمزوّدين</h3>
            <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
              ضع المفتاح هنا، اضغط حفظ — البوت هياخده فوراً بدون أي إعداد على السيرفر. المفتاح بيتخزّن في قاعدة البيانات بشكل آمن.
              لو سيبت الخانة فاضية، المفتاح القديم بيفضل زي ما هو.
            </p>
          </div>
          {(['gemini', 'openai', 'anthropic'] as AiProvider[]).map(p => {
            const info = PROVIDER_INFO[p];
            // apiKeys may be undefined on a fresh install — fall back
            // to false rather than throwing.
            const isConfigured = !!(data.settings.apiKeys && data.settings.apiKeys[p]);
            const isActive = provider === p;
            return (
              <div key={p} className={`bg-white border rounded-lg p-3 ${isActive ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{info.label}</span>
                    {isActive && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">نشط</span>}
                    {isConfigured
                      ? <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">✅ مفتاح مُهيّأ</span>
                      : <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">— لا يوجد مفتاح</span>}
                  </div>
                  <a
                    href={info.getKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-700 hover:underline font-bold"
                  >
                    احصل على مفتاح ↗
                  </a>
                </div>
                <p className="text-[10px] text-gray-500 mb-2">{info.help}</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyInputs[p]}
                    onChange={e => setKeyInputs(prev => ({ ...prev, [p]: e.target.value }))}
                    placeholder={isConfigured ? '•••••••• (سيب فاضي عشان تحتفظ بالمفتاح القديم)' : 'الصق المفتاح هنا...'}
                    autoComplete="new-password"
                    dir="ltr"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  {isConfigured && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`حذف مفتاح ${info.label}؟`)) {
                          setKeyInputs(prev => ({ ...prev, [p]: '__CLEAR__' }));
                          addToast(`سيتم حذف مفتاح ${info.label} عند الحفظ`, 'warning');
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition shrink-0"
                    >
                      🗑️ حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="مزوّد الـ AI النشط">
            <select
              value={provider}
              onChange={e => {
                const p = e.target.value as AiProvider;
                setProvider(p);
                setModel(PROVIDER_INFO[p].defaultModel);
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="gemini">Google Gemini (مجاني 🆓)</option>
              <option value="openai">OpenAI ChatGPT (مدفوع)</option>
              <option value="anthropic">Anthropic Claude (مدفوع)</option>
            </select>
          </Field>
          <Field label="الموديل">
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {PROVIDER_INFO[provider].models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label="حد أقصى للرد (tokens)">
            <input
              type="number"
              min={50}
              max={2000}
              value={maxTokens}
              onChange={e => setMaxTokens(Number(e.target.value) || 300)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
          </Field>
          <Field label="كلمات تحفيز (اختياري)" hint="لو فيه كلمات هنا، البوت بيرد بس لو الرسالة فيها واحدة منهم. سيبه فاضي عشان يرد على الكل.">
            <input
              type="text"
              value={triggerKeywordsRaw}
              onChange={e => setTriggerKeywordsRaw(e.target.value)}
              placeholder="سعر, شحن, متاح, متوفر"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-xs font-black transition disabled:opacity-50"
          >
            {saving ? '...جاري الحفظ' : '💾 حفظ الإعدادات'}
          </button>
        </div>
      </div>

      {/* Knowledge base — what the bot KNOWS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-black text-gray-900">📚 المعرفة المتاحة للبوت</h2>
          <button onClick={loadKnowledge} className="text-xs text-blue-700 hover:underline font-bold">🔄 تحديث</button>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          البوت بياخد معاه — في كل رد — قائمة بكل المنتجات والكتب وأسعار الشحن من الموقع، عشان يرد بأسعار حقيقية محدّثة.
          الداتا بتتجدّد كل 5 دقائق تلقائياً.
        </p>
        {kbStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <KbStat label="منتجات" value={kbStats.productCount} />
            <KbStat label="كتب" value={kbStats.bookCount} />
            <KbStat label="سلاسل" value={kbStats.seriesCount} />
            <KbStat label="مناطق شحن" value={kbStats.shippingZoneCount} />
            <KbStat label="كوبونات" value={kbStats.couponCount} />
            <KbStat label="أسئلة شائعة" value={kbStats.faqCount} />
          </div>
        )}
        <button
          onClick={() => setKbPreviewOpen(o => !o)}
          className="text-xs text-blue-700 hover:underline font-bold"
        >
          {kbPreviewOpen ? '▴ إخفاء' : '▾ عرض'} الـ context الكامل اللي بيدخل البوت ({kbStats?.approxChars ?? 0} حرف)
        </button>
        {kbPreviewOpen && (
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[10px] leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono" dir="rtl">
            {kbPreview}
          </pre>
        )}

        <Field label="معلومات إضافية / أسئلة شائعة (يمكن لحضرتك تضيفها — البوت هياخدها معاه)" hint="اكتب هنا أي حاجة عاوز البوت يعرفها: سياسة الإرجاع، أوقات العمل، أسعار خاصة، تخفيضات، ساعات الرد، إلخ. الكتابة Markdown.">
          <textarea
            value={faqs}
            onChange={e => setFaqs(e.target.value)}
            rows={5}
            placeholder={'مثال:\n- سياسة الإرجاع: متاح خلال 14 يوم.\n- ساعات العمل: 9 صباحاً – 9 مساءً.\n- توصيل مجاني للطلبات فوق 500 ج.م.'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
            dir="rtl"
          />
        </Field>
        <div className="flex justify-end">
          <button
            onClick={saveFaqs}
            disabled={savingFaqs}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition disabled:opacity-50"
          >
            {savingFaqs ? '...جاري الحفظ' : '💾 حفظ المعرفة'}
          </button>
        </div>
      </div>

      {/* Test message */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-base font-black text-gray-900">🧪 اختبار البوت</h2>
        <p className="text-[11px] text-gray-500">اكتب رسالة كأنك عميل، البوت هيرد عليك هنا بنفس الطريقة اللي هيرد بيها على Messenger. الاختبار <strong>ما بيرسل حاجة لفيسبوك</strong>.</p>
        <textarea
          value={testMessage}
          onChange={e => setTestMessage(e.target.value)}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={runTest}
            disabled={testing || !hasAiKey}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition disabled:opacity-50"
          >
            {testing ? '...جاري الاختبار' : '🤖 جرّب'}
          </button>
        </div>
        {testReply && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[10px] text-blue-700 font-bold mb-1">رد البوت:</p>
            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{testReply}</p>
          </div>
        )}
      </div>

      {/* Conversion analytics — last 30 days */}
      <AnalyticsCard />

      {/* Inbox */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-gray-900">📥 المحادثات ({data.conversations.length})</h2>
          <button onClick={load} className="text-xs text-blue-700 hover:underline font-bold">🔄 تحديث</button>
        </div>
        {data.conversations.length === 0 ? (
          <EmptyState
            message="مفيش رسائل لسه — جرّب ابعت 'Hello' لصفحة Moslim Leader على Messenger من حسابك"
            icon="💬"
          />
        ) : (
          <>
            {/* Filter chips: chat / comments / all */}
            <div className="px-4 pt-3 pb-2 flex gap-2 flex-wrap border-b border-gray-100">
              {([
                { k: 'all',     label: 'الكل', count: data.conversations.length },
                { k: 'message', label: '💬 رسائل', count: data.conversations.filter(c => c.kind === 'message').length },
                { k: 'comment', label: '🗨️ تعليقات', count: data.conversations.filter(c => c.kind === 'comment').length },
              ] as const).map(f => (
                <button
                  key={f.k}
                  onClick={() => { setFilter(f.k); setActiveKey(null); }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition ${filter === f.k ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'}`}
                >
                  {f.label} <span className="opacity-70">({f.count})</span>
                </button>
              ))}
              <span className="w-px bg-gray-200 mx-1" />
              {([
                { k: 'all',  label: 'كل التصنيفات', count: data.conversations.length },
                { k: 'hot',  label: '🔥 جاهز يشتري',  count: data.conversations.filter(c => c.leadStatus === 'hot').length },
                { k: 'warm', label: '🟡 مهتم',        count: data.conversations.filter(c => c.leadStatus === 'warm').length },
              ] as const).map(f => (
                <button
                  key={'lead-' + f.k}
                  onClick={() => { setLeadFilter(f.k); setActiveKey(null); }}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition ${leadFilter === f.k ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400'}`}
                >
                  {f.label} <span className="opacity-70">({f.count})</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[400px]">
            {/* Conversation list */}
            <div className="lg:col-span-1 border-l border-gray-100 max-h-[500px] overflow-y-auto">
              {filteredConversations.map(c => (
                <button
                  key={c.key}
                  onClick={() => { setActiveKey(c.key); setManualReply(''); }}
                  className={`w-full text-right p-3 border-b border-gray-100 hover:bg-gray-50 transition ${activeKey === c.key ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate flex-1">
                      {c.userGender === 'female' ? '♀️ ' : c.userGender === 'male' ? '♂️ ' : ''}
                      {c.userName ?? `User ${c.psid.slice(-6)}`}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.leadStatus && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${LEAD_BADGE[c.leadStatus].cls}`}>
                          {LEAD_BADGE[c.leadStatus].icon}
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${c.kind === 'comment' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.kind === 'comment' ? '🗨️' : '💬'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 truncate">{c.events[0]?.text ?? '—'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {fmtDateTime(c.lastAt)} · {c.eventCount} رسالة
                    {c.leadStatus && <span className="mr-2 font-bold">· {LEAD_BADGE[c.leadStatus].label}</span>}
                  </p>
                </button>
              ))}
            </div>

            {/* Active thread */}
            <div className="lg:col-span-2 flex flex-col max-h-[500px]">
              {activeConversation ? (
                <>
                  <ConversationActionBar
                    conversation={activeConversation}
                    onRefresh={load}
                    addToast={addToast}
                  />
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                    {[...activeConversation.events].reverse().map(e => (
                      <MessageBubble key={e.id} event={e} />
                    ))}
                  </div>
                  <div className="border-t border-gray-200 p-3 bg-white space-y-2">
                    <textarea
                      value={manualReply}
                      onChange={e => setManualReply(e.target.value)}
                      rows={2}
                      placeholder={
                        activeConversation.kind === 'comment'
                          ? 'رد يدوي على التعليق (هيظهر للجميع في البوست)...'
                          : 'رد يدوي على Messenger...'
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2 justify-between flex-wrap">
                      {activeConversation.kind === 'comment' && activeConversation.postId ? (
                        <Link
                          href={`https://www.facebook.com/${activeConversation.postId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-gray-500 hover:text-blue-700"
                        >
                          فتح البوست على فيسبوك ↗
                        </Link>
                      ) : (
                        <Link
                          href={`https://www.facebook.com/${activeConversation.psid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-gray-500 hover:text-blue-700"
                        >
                          فتح بروفايل العميل ↗
                        </Link>
                      )}
                      <button
                        onClick={sendManual}
                        disabled={sending || !manualReply.trim() || !status.hasPageToken}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition disabled:opacity-50"
                      >
                        {sending ? '...جاري الإرسال' : '📤 إرسال'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-6 text-center">
                  اختار محادثة من اليمين عشان تشوف الرسائل وترد يدوياً
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function KbStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
      <p className="text-[9px] text-gray-500 font-bold tracking-widest">{label}</p>
      <p className="text-lg font-black text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 border text-[11px] font-bold flex items-center gap-2 ${ok ? 'bg-emerald-500/15 border-emerald-300/30 text-emerald-200' : 'bg-red-500/15 border-red-300/30 text-red-200'}`}>
      <span>{ok ? '✅' : '❌'}</span>
      <div className="min-w-0 flex-1">
        <span dir="ltr" className="truncate block">{label}</span>
        {hint && <span className="text-[9px] opacity-70 block" dir="rtl">{hint}</span>}
      </div>
    </div>
  );
}

function MessageBubble({ event }: { event: ConversationEvent }) {
  const isIncoming = event.direction === 'incoming';
  const isAuto = event.direction === 'outgoing-auto';
  const failed = event.sendStatus === 'failed';
  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
        isIncoming
          ? 'bg-white border border-gray-200'
          : isAuto
            ? 'bg-blue-600 text-white'
            : 'bg-emerald-600 text-white'
      }`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{event.text || (failed ? '— فشل إرسال —' : '—')}</p>
        <p className={`text-[9px] mt-1 ${isIncoming ? 'text-gray-400' : 'text-white/70'}`}>
          {isIncoming ? 'وارد' : isAuto ? `🤖 ${event.aiModel ?? 'AI'}` : '✋ يدوي'}
          {' · '}
          {new Date(event.createdAt).toLocaleString('ar-EG', { hour12: false })}
          {failed && <span className="text-red-200 mr-1">· فشل: {event.sendError?.slice(0, 80)}</span>}
        </p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-gray-700 font-bold mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Conversation action bar — shows above the message thread when a
// conversation is selected. Surfaces:
//   • Extracted profile (name, phone, governorate, kid ages)
//   • 📦 Create Order (opens the modal)
//   • 📞 WhatsApp link (when phone is extracted)
//   • 🤐 Mute / 🔔 Unmute auto-reply for this thread
//   • 🛎️ "Needs attention" pill when AI errored
// ──────────────────────────────────────────────────────────────────
function ConversationActionBar({
  conversation,
  onRefresh,
  addToast,
}: {
  conversation: Conversation;
  onRefresh: () => void;
  addToast: (msg: string, kind?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [muting, setMuting] = useState(false);
  const p = conversation.profile;

  const toggleMute = async () => {
    setMuting(true);
    try {
      const res = await adminFetch('/api/admin/ai-facebook-assistant/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psid: conversation.psid, mute: !conversation.muted }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل', 'error'); setMuting(false); return; }
      addToast(conversation.muted ? 'تم استئناف الرد التلقائي' : 'تم إيقاف الرد التلقائي على هذه المحادثة', 'success');
      onRefresh();
    } catch { addToast('فشل', 'error'); }
    setMuting(false);
  };

  // wa.me deep link — uses E.164 (Egypt: +20<...>).
  const waUrl = p.phone
    ? `https://wa.me/2${p.phone.replace(/^0/, '')}?text=${encodeURIComponent(
        `أهلاً ${p.name ?? ''} 🌹 من فريق مسلم ليدر — متابعة لرسالتك`
      )}`
    : null;

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-900 mb-1">
              👤 ما نعرفه عن العميل:
            </p>
            <div className="flex items-center gap-2 flex-wrap text-[10px]">
              {p.name        && <Pill label={`👤 ${p.name}`} />}
              {p.phone       && <Pill label={`📞 ${p.phone}`} tone="emerald" />}
              {p.governorate && <Pill label={`📍 ${p.governorate}`} />}
              {p.address     && <Pill label={`🏠 ${p.address.slice(0, 40)}${p.address.length > 40 ? '…' : ''}`} />}
              {p.kidAges.length > 0 && <Pill label={`👶 أعمار: ${p.kidAges.join('، ')}`} />}
              {!p.name && !p.phone && !p.address && !p.governorate && p.kidAges.length === 0 && (
                <span className="text-amber-700 italic">— لم يتم استخراج بيانات بعد —</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {conversation.needsAttention && (
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">
                🛎️ يحتاج تدخّلك
              </span>
            )}
            {conversation.muted && (
              <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold">
                🤐 الرد متوقف
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-2">
          <button
            onClick={() => setCreating(true)}
            disabled={!p.phone || conversation.kind !== 'message'}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={!p.phone ? 'الموبايل مش موجود — اطلبه من العميل أولاً' : ''}
          >
            📦 إنشاء طلب
          </button>
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[11px] font-black transition"
            >
              📞 واتساب
            </a>
          )}
          <button
            onClick={toggleMute}
            disabled={muting}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition ${conversation.muted ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-amber-200 hover:bg-amber-300 text-amber-900'} disabled:opacity-50`}
            title={conversation.muted ? 'استأنف الرد التلقائي' : 'أوقف الرد التلقائي على هذه المحادثة فقط'}
          >
            {conversation.muted ? '🔔 استأنف الرد' : '🤐 أوقف الرد'}
          </button>
        </div>
      </div>

      {creating && (
        <CreateOrderModal
          conversation={conversation}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); onRefresh(); }}
          addToast={addToast}
        />
      )}
    </>
  );
}

function Pill({ label, tone }: { label: string; tone?: 'emerald' | 'amber' }) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : 'bg-white text-amber-900 border-amber-200';
  return (
    <span className={`px-2 py-0.5 rounded border font-bold ${cls}`}>{label}</span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Create-Order modal — pre-filled from the conversation profile.
// Pulls the catalogue from /api/admin/products so the admin picks
// real product ids; computes total client-side for display only
// (server re-validates).
// ──────────────────────────────────────────────────────────────────
interface CatalogProduct { id: string; name: string; price: number; category: string }

function CreateOrderModal({
  conversation,
  onClose,
  onCreated,
  addToast,
}: {
  conversation: Conversation;
  onClose: () => void;
  onCreated: () => void;
  addToast: (msg: string, kind?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
}) {
  const p = conversation.profile;
  const [name, setName] = useState(p.name ?? conversation.userName ?? '');
  const [phone, setPhone] = useState(p.phone ?? '');
  const [address, setAddress] = useState(p.address ?? '');
  const [governorate, setGovernorate] = useState(p.governorate ?? 'القاهرة');
  const [productSearch, setProductSearch] = useState('');
  const [productList, setProductList] = useState<CatalogProduct[]>([]);
  const [items, setItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    adminFetch('/api/admin/products?lite=true')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!alive || !d?.products) return;
        const list: CatalogProduct[] = d.products.map((x: { id: string; name: string; price: number; category?: string }) => ({
          id: x.id, name: x.name, price: x.price, category: x.category ?? '',
        }));
        setProductList(list);
      })
      .catch(() => {/* ignore */});
    return () => { alive = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return productList.slice(0, 30);
    return productList.filter(p =>
      p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [productList, productSearch]);

  const productMap = useMemo(() => new Map(productList.map(p => [p.id, p])), [productList]);

  const subtotal = items.reduce((s, it) => {
    const p = productMap.get(it.productId);
    return s + (p ? p.price * it.quantity : 0);
  }, 0);

  const addItem = (productId: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !address.trim() || !governorate.trim()) {
      addToast('املأ كل البيانات الأساسية', 'warning');
      return;
    }
    if (items.length === 0) { addToast('اختر منتج واحد على الأقل', 'warning'); return; }
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/ai-facebook-assistant/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psid: conversation.psid,
          name, phone, address, governorate,
          items,
        }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل إنشاء الطلب', 'error'); setSubmitting(false); return; }
      addToast(`✅ تم إنشاء الطلب #${d.orderId.slice(-8)} بإجمالي ${d.total} ج.م`, 'success', 6000);
      onCreated();
    } catch { addToast('فشل إنشاء الطلب', 'error'); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-black text-gray-900">📦 إنشاء طلب من المحادثة</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="الاسم *">
              <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="الموبايل *">
              <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" dir="ltr" />
            </Field>
            <Field label="المحافظة *">
              <input value={governorate} onChange={e => setGovernorate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="العنوان *">
              <input value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>

          <Field label={`المنتجات (${items.length} مختار)`}>
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="🔍 ابحث عن منتج..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
            />
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
              {filteredProducts.length === 0 && <p className="text-[11px] text-gray-500 text-center py-3">لا منتجات مطابقة</p>}
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addItem(p.id)}
                  className="w-full text-right flex items-center justify-between gap-2 bg-white px-2 py-1.5 rounded hover:bg-emerald-50 text-[11px]"
                >
                  <span className="text-gray-800">{p.name}</span>
                  <span className="font-bold text-gray-700 shrink-0">{Math.round(p.price)} ج.م</span>
                </button>
              ))}
            </div>
          </Field>

          {items.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 bg-emerald-50/50">
              <p className="text-[11px] font-bold text-gray-700 mb-2">العناصر المحددة:</p>
              <div className="space-y-1.5">
                {items.map(it => {
                  const prod = productMap.get(it.productId);
                  if (!prod) return null;
                  return (
                    <div key={it.productId} className="flex items-center gap-2 text-[11px]">
                      <span className="flex-1 font-bold text-gray-800">{prod.name}</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={it.quantity}
                        onChange={e => {
                          const q = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                          setItems(prev => prev.map(i => i.productId === it.productId ? { ...i, quantity: q } : i));
                        }}
                        className="w-14 border border-gray-200 rounded px-2 py-1 text-center"
                      />
                      <span className="w-20 text-left font-bold text-emerald-700">{Math.round(prod.price * it.quantity)} ج.م</span>
                      <button onClick={() => removeItem(it.productId)} className="text-red-600 hover:text-red-800 px-1">🗑️</button>
                    </div>
                  );
                })}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-black text-gray-900">
                  <span>المجموع الفرعي</span>
                  <span>{Math.round(subtotal)} ج.م</span>
                </div>
                <p className="text-[10px] text-gray-500 text-left">+ الشحن (يحسب على السيرفر حسب المحافظة)</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold">إلغاء</button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition disabled:opacity-50"
            >
              {submitting ? '...جاري الإنشاء' : '✅ إنشاء الطلب'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Conversion analytics card — sits above the inbox. Pulls from
// /api/admin/ai-facebook-assistant/analytics. Shows:
//   • Funnel: messages → bot replies → HOT → orders
//   • Conversion rate
//   • Intent breakdown (price / shipping / ready / objection / general)
//   • Top products by mentions vs orders
// ──────────────────────────────────────────────────────────────────
interface AnalyticsPayload {
  windowDays: number;
  funnel: {
    incomingMessages: number;
    botReplies: number;
    replyRate: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    ordersCreated: number;
    revenueEgp: number;
    conversionRate: number;
  };
  intentBreakdown: Record<string, number>;
  topProducts: Array<{ id: string; name: string; mentions: number; orders: number }>;
  generatedAt: string;
}

function AnalyticsCard() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    adminFetch('/api/admin/ai-facebook-assistant/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) { setData(d); setLoading(false); } })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (loading || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 text-[11px] text-gray-500">
        جاري تحميل تحليلات التحويل...
      </div>
    );
  }
  const f = data.funnel;
  const intentLabel: Record<string, string> = {
    'price-question':    '💰 سعر',
    'shipping-question': '🚚 شحن',
    'ready-to-buy':      '🔥 جاهز يطلب',
    'objection':         '🛡️ اعتراض',
    'general':           '💬 عام',
  };
  return (
    <div className="bg-gradient-to-l from-emerald-50 via-white to-amber-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-black text-gray-900">
          📊 لوحة التحويل (آخر {data.windowDays} يوم)
        </h2>
        <span className="text-[10px] text-gray-500">
          آخر تحديث: {fmtDateTime(data.generatedAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <FunnelStat label="رسائل واردة" value={f.incomingMessages} />
        <FunnelStat label="ردود البوت" value={f.botReplies} sub={`${(f.replyRate * 100).toFixed(0)}%`} />
        <FunnelStat label="🟡 مهتمون" value={f.warmLeads} tone="amber" />
        <FunnelStat label="🔥 جاهزون" value={f.hotLeads} tone="red" />
        <FunnelStat label="📦 طلبات أُنشئت" value={f.ordersCreated} tone="emerald" sub={`${(f.conversionRate * 100).toFixed(0)}% من HOT`} />
        <FunnelStat label="💵 إيرادات" value={`${f.revenueEgp.toLocaleString('en-US')} ج.م`} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-[11px] font-bold text-gray-700 mb-2">🎯 توزيع نوايا العملاء</p>
          <div className="space-y-1.5">
            {Object.entries(intentLabel).map(([key, label]) => {
              const count = data.intentBreakdown[key] ?? 0;
              const total = Object.values(data.intentBreakdown).reduce((s, n) => s + n, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-2 text-[11px]">
                  <span className="w-24 text-gray-700 shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden" dir="ltr">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="w-10 text-left font-bold text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-[11px] font-bold text-gray-700 mb-2">🏆 المنتجات الأكثر ذكراً</p>
          {data.topProducts.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">لا توجد بيانات بعد</p>
          ) : (
            <ol className="space-y-1.5">
              {data.topProducts.map((p, idx) => (
                <li key={p.id} className="flex items-center gap-2 text-[11px]">
                  <span className="w-5 text-center text-gray-400 font-bold">{idx + 1}.</span>
                  <span className="flex-1 text-gray-800 truncate">{p.name}</span>
                  <span className="text-blue-700 font-bold shrink-0">{p.mentions} ذكر</span>
                  {p.orders > 0 && (
                    <span className="text-emerald-700 font-bold shrink-0">+ {p.orders} طلب</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function FunnelStat({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: 'amber' | 'red' | 'emerald' }) {
  const cls = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 text-center">
      <p className="text-[9px] text-gray-500 font-bold tracking-widest">{label}</p>
      <p className={`text-base font-black mt-0.5 ${cls}`}>{value}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
