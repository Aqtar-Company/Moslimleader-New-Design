'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { adminFetch, ForbiddenError } from '@/lib/admin-fetch';
import Spinner from '@/components/admin/Spinner';
import EmptyState from '@/components/admin/EmptyState';
import ForbiddenState from '@/components/admin/ForbiddenState';

type AiProvider = 'openai' | 'gemini';

interface Settings {
  enabled: boolean;
  systemPrompt: string;
  provider: AiProvider;
  model: string;
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
      if (!res.ok) throw new Error('failed');
      const d = await res.json();
      setData(d);
      setEnabled(d.settings.enabled);
      setSystemPrompt(d.settings.systemPrompt);
      setProvider(d.settings.provider ?? 'gemini');
      setModel(d.settings.model);
      setMaxTokens(d.settings.maxTokens);
      setTriggerKeywordsRaw((d.settings.triggerKeywords ?? []).join(', '));
    } catch (err) {
      if (err instanceof ForbiddenError) setForbidden(true);
      else addToast('فشل التحميل', 'error');
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
      const res = await adminFetch('/api/admin/ai-facebook-assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, systemPrompt, provider, model, maxTokens, triggerKeywords }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error || 'فشل الحفظ', 'error'); setSaving(false); return; }
      addToast('تم الحفظ', 'success');
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
  const hasAiKey = provider === 'openai' ? status.hasOpenAiKey : status.hasGeminiKey;
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          <StatusBadge label="GEMINI_API_KEY" ok={status.hasGeminiKey} hint="مجاني — ai.google.dev" />
          <StatusBadge label="OPENAI_API_KEY" ok={status.hasOpenAiKey} hint="مدفوع — platform.openai.com" />
          <StatusBadge label="FB_PAGE_ACCESS_TOKEN" ok={status.hasPageToken} />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="مزوّد الـ AI">
            <select
              value={provider}
              onChange={e => {
                const p = e.target.value as AiProvider;
                setProvider(p);
                // Auto-pick a sensible default model for the chosen provider.
                setModel(p === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="gemini">Google Gemini (مجاني 🆓)</option>
              <option value="openai">OpenAI (مدفوع)</option>
            </select>
          </Field>
          <Field label="الموديل">
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {provider === 'gemini' ? (
                <>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (مجاني، أسرع)</option>
                  <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b (مجاني، الأرخص)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (أفضل جودة)</option>
                  <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (تجريبي)</option>
                </>
              ) : (
                <>
                  <option value="gpt-4o-mini">gpt-4o-mini (الأرخص)</option>
                  <option value="gpt-4o">gpt-4o (أفضل جودة)</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </>
              )}
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
