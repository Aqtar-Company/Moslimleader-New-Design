'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Settings {
  isEnabled: boolean;
  messengerEnabled: boolean;
  commentsEnabled: boolean;
  replyMode: 'draft' | 'auto';
  tone: 'warm' | 'formal' | 'sales';
  dailyLimit: number;
  escalationKeywords: string;
  hasToken: boolean;
}

interface Message {
  id: string;
  messageId: string;
  direction: string;
  text: string;
  source: string;
  relatedProduct: string | null;
  aiIntent: string | null;
  aiReply: string | null;
  status: string;
  metaResponse: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface Conversation {
  id: string;
  senderId: string;
  senderName: string | null;
  source: string;
  status: string;
  createdAt: string;
  messages: Message[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  sent:      'bg-emerald-100 text-emerald-800 border-emerald-200',
  escalated: 'bg-red-100 text-red-800 border-red-200',
  ignored:   'bg-gray-100 text-gray-600 border-gray-200',
  failed:    'bg-red-50 text-red-700 border-red-200',
};

const STATUS_AR: Record<string, string> = {
  draft:     'مسودة',
  sent:      'مُرسَل',
  escalated: 'مُصعَّد',
  ignored:   'مُتجاهَل',
  failed:    'فشل',
};

const INTENT_AR: Record<string, string> = {
  price:        '💰 سعر',
  availability: '📦 توفر',
  shipping:     '🚚 شحن',
  payment:      '💳 دفع',
  discount:     '🎟️ خصم',
  complaint:    '⚠️ شكوى',
  order:        '📋 طلب',
  details:      '🔍 تفاصيل',
  wholesale:    '🏪 جملة',
  other:        '💬 أخرى',
};

const TONE_AR: Record<string, string> = { warm: 'دافئ 🌿', formal: 'رسمي 🎩', sales: 'تسويقي 💼' };
const TONE_DESC: Record<string, string> = {
  warm:   'أسلوب دافئ وودود يعكس قيم مسلم ليدر',
  formal: 'أسلوب رسمي ومحترف',
  sales:  'أسلوب تسويقي يبرز قيمة المنتج',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AiFacebookAssistantPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'settings' | 'inbox' | 'logs'>('inbox');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pageToken, setPageToken] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [statusFilter, setStatusFilter] = useState('draft');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [editingReply, setEditingReply] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ─── Load settings ──────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-facebook-assistant/settings', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch {
      addToast('فشل تحميل الإعدادات', 'error');
    }
  }, [addToast]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ─── Load conversations ──────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const url = `/api/admin/ai-facebook-assistant/conversations?status=${statusFilter}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      addToast('فشل تحميل المحادثات', 'error');
    }
    setLoadingConvs(false);
  }, [statusFilter, addToast]);

  useEffect(() => {
    if (tab === 'inbox' || tab === 'logs') loadConversations();
  }, [tab, loadConversations]);

  // ─── Save settings ──────────────────────────────────────────────────────────

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/ai-facebook-assistant/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, ...(pageToken ? { pageAccessToken: pageToken } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        setPageToken('');
        addToast('تم حفظ الإعدادات ✅', 'success');
      } else {
        addToast(data.error ?? 'فشل الحفظ', 'error');
      }
    } catch {
      addToast('خطأ في الاتصال', 'error');
    }
    setSavingSettings(false);
  };

  // ─── Message actions ─────────────────────────────────────────────────────────

  const updateMessage = async (msgId: string, patch: { status?: string; aiReply?: string }) => {
    const res = await fetch(`/api/admin/ai-facebook-assistant/messages/${msgId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return res.ok;
  };

  const sendReply = async (msg: Message) => {
    setActionLoading(p => ({ ...p, [msg.id]: true }));
    const replyText = editingReply[msg.id] ?? msg.aiReply ?? '';
    if (!replyText.trim()) {
      addToast('لا يوجد رد للإرسال', 'error');
      setActionLoading(p => ({ ...p, [msg.id]: false }));
      return;
    }
    const res = await fetch('/api/facebook/send-reply', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id, replyText }),
    });
    if (res.ok) {
      addToast('تم الإرسال بنجاح ✅', 'success');
      await loadConversations();
      setSelectedConv(null);
    } else {
      const data = await res.json();
      addToast(data.error ?? 'فشل الإرسال', 'error');
    }
    setActionLoading(p => ({ ...p, [msg.id]: false }));
  };

  const ignoreMessage = async (msg: Message) => {
    setActionLoading(p => ({ ...p, [msg.id]: true }));
    await updateMessage(msg.id, { status: 'ignored' });
    addToast('تم تجاهل الرسالة', 'success');
    await loadConversations();
    setSelectedConv(null);
    setActionLoading(p => ({ ...p, [msg.id]: false }));
  };

  const escalateMessage = async (msg: Message) => {
    setActionLoading(p => ({ ...p, [msg.id]: true }));
    await updateMessage(msg.id, { status: 'escalated' });
    addToast('تم تصعيد الرسالة للمراجعة اليدوية', 'success');
    await loadConversations();
    setSelectedConv(null);
    setActionLoading(p => ({ ...p, [msg.id]: false }));
  };

  const regenerateReply = async (msg: Message) => {
    setActionLoading(p => ({ ...p, [`regen-${msg.id}`]: true }));
    const res = await fetch('/api/ai/facebook-reply', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id, text: msg.text, tone: settings?.tone ?? 'warm', source: msg.source }),
    });
    if (res.ok) {
      addToast('تم إعادة توليد الرد 🤖', 'success');
      await loadConversations();
      // Update selectedConv if open
      if (selectedConv) {
        const updated = conversations.find(c => c.id === selectedConv.id);
        if (updated) setSelectedConv(updated);
      }
    } else {
      addToast('فشل توليد الرد', 'error');
    }
    setActionLoading(p => ({ ...p, [`regen-${msg.id}`]: false }));
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const draftCount = conversations.reduce((acc, c) =>
    acc + c.messages.filter(m => m.status === 'draft' && m.direction === 'incoming').length, 0);
  const escalatedCount = conversations.reduce((acc, c) =>
    acc + c.messages.filter(m => m.status === 'escalated').length, 0);

  const inboxMessages = conversations.flatMap(conv =>
    conv.messages
      .filter(m => m.direction === 'incoming')
      .map(m => ({ ...m, conv }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const logsMessages = conversations.flatMap(conv =>
    conv.messages.map(m => ({ ...m, conv }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            🤖 مساعد فيسبوك الذكي
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            رد تلقائي بالذكاء الاصطناعي على رسائل وتعليقات فيسبوك
          </p>
        </div>
        {settings && (
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${settings.isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {settings.isEnabled ? '✅ مُفعَّل' : '⏸️ موقوف'}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'رسائل جديدة', value: draftCount, color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: '📬' },
          { label: 'تحتاج مراجعة', value: escalatedCount, color: 'text-red-700 bg-red-50 border-red-200', icon: '🚨' },
          { label: 'إجمالي المحادثات', value: conversations.length, color: 'text-blue-700 bg-blue-50 border-blue-200', icon: '💬' },
          { label: 'تم الإرسال', value: logsMessages.filter(m => m.status === 'sent').length, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: '✅' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-3 ${stat.color}`}>
            <div className="text-lg font-black">{stat.icon} {stat.value}</div>
            <div className="text-xs mt-0.5 opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['inbox', 'logs', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'inbox' && `📬 الصندوق ${draftCount > 0 ? `(${draftCount})` : ''}`}
            {t === 'logs' && '📋 السجل'}
            {t === 'settings' && '⚙️ الإعدادات'}
          </button>
        ))}
      </div>

      {/* ── INBOX TAB ── */}
      {tab === 'inbox' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap">
            {['draft', 'escalated', 'sent', 'ignored', 'failed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  statusFilter === s ? STATUS_COLORS[s] + ' border-2' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {STATUS_AR[s]}
              </button>
            ))}
            <button
              onClick={loadConversations}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              🔄 تحديث
            </button>
          </div>

          {loadingConvs ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : inboxMessages.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">لا توجد رسائل بهذا التصنيف</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {inboxMessages.map(({ conv, ...msg }) => (
                <MessageCard
                  key={msg.id}
                  msg={msg}
                  conv={conv}
                  editingReply={editingReply}
                  actionLoading={actionLoading}
                  onEditReply={(id, val) => setEditingReply(p => ({ ...p, [id]: val }))}
                  onSend={() => sendReply(msg)}
                  onIgnore={() => ignoreMessage(msg)}
                  onEscalate={() => escalateMessage(msg)}
                  onRegenerate={() => regenerateReply(msg)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {tab === 'logs' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['العميل', 'الرسالة', 'الرد', 'المصدر', 'النية', 'الحالة', 'التاريخ'].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logsMessages.map(({ conv, ...msg }) => (
                  <tr key={msg.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {conv.senderName ?? conv.senderId.slice(-6)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{msg.text}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{msg.aiReply ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${msg.source === 'messenger' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {msg.source === 'messenger' ? '💬 ماسنجر' : '🗨️ تعليق'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{INTENT_AR[msg.aiIntent ?? ''] ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[msg.status] ?? ''}`}>
                        {STATUS_AR[msg.status] ?? msg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {logsMessages.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">لا توجد سجلات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && settings && (
        <div className="max-w-2xl space-y-5">
          {/* Enable/disable */}
          <SettingsSection title="🔌 التفعيل العام">
            <Toggle
              label="تفعيل مساعد فيسبوك الذكي"
              desc="عند التعطيل يتوقف الاستقبال والرد التلقائي كليًا"
              checked={settings.isEnabled}
              onChange={v => setSettings(s => s ? { ...s, isEnabled: v } : s)}
            />
            <Toggle
              label="رسائل الماسنجر"
              desc="الرد على رسائل الصندوق الوارد الخاصة"
              checked={settings.messengerEnabled}
              onChange={v => setSettings(s => s ? { ...s, messengerEnabled: v } : s)}
            />
            <Toggle
              label="تعليقات المنشورات"
              desc="الرد على تعليقات الصفحة (يتطلب صلاحية pages_read_engagement)"
              checked={settings.commentsEnabled}
              onChange={v => setSettings(s => s ? { ...s, commentsEnabled: v } : s)}
            />
          </SettingsSection>

          {/* Reply mode */}
          <SettingsSection title="📤 طريقة الرد">
            <div className="grid grid-cols-2 gap-3">
              {(['draft', 'auto'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSettings(s => s ? { ...s, replyMode: mode } : s)}
                  className={`p-4 rounded-xl border-2 text-right transition-all ${
                    settings.replyMode === mode
                      ? 'border-[#F5C518] bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm text-gray-900">
                    {mode === 'draft' ? '✍️ مسودة للمراجعة' : '⚡ إرسال تلقائي'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {mode === 'draft' ? 'يتوقف على موافقة الأدمن قبل الإرسال' : 'يُرسَل تلقائيًا للاستفسارات الآمنة فقط'}
                  </div>
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Tone */}
          <SettingsSection title="🎙️ نبرة الرد">
            <div className="grid grid-cols-3 gap-3">
              {(['warm', 'formal', 'sales'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSettings(s => s ? { ...s, tone: t } : s)}
                  className={`p-3 rounded-xl border-2 text-right transition-all ${
                    settings.tone === t ? 'border-[#F5C518] bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-sm">{TONE_AR[t]}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{TONE_DESC[t]}</div>
                </button>
              ))}
            </div>
          </SettingsSection>

          {/* Escalation keywords */}
          <SettingsSection title="🚨 كلمات التصعيد">
            <p className="text-xs text-gray-500 mb-2">الرسائل التي تحتوي على هذه الكلمات تُصعَّد للمراجعة اليدوية ولا تُرسَل تلقائيًا أبدًا.</p>
            <textarea
              value={settings.escalationKeywords}
              onChange={e => setSettings(s => s ? { ...s, escalationKeywords: e.target.value } : s)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]/40"
              placeholder="شكوى,غالي,لم يصل,استرجاع,نصب,إلغاء,مشكلة"
            />
          </SettingsSection>

          {/* Daily limit */}
          <SettingsSection title="📊 حد الردود اليومي">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={500}
                value={settings.dailyLimit}
                onChange={e => setSettings(s => s ? { ...s, dailyLimit: parseInt(e.target.value) || 50 } : s)}
                className="w-28 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#F5C518]/40"
              />
              <span className="text-sm text-gray-500">رد يومي كحد أقصى</span>
            </div>
          </SettingsSection>

          {/* Facebook credentials */}
          <SettingsSection title="🔑 بيانات فيسبوك">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Page Access Token</label>
                <input
                  type="password"
                  value={pageToken}
                  onChange={e => setPageToken(e.target.value)}
                  placeholder={settings.hasToken ? '••••••••••••••• (محفوظ)' : 'الصق التوكن هنا...'}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]/40"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  يُخزَّن مشفرًا على السيرفر فقط ولا يظهر مرة أخرى في الواجهة.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 space-y-1">
                <p className="font-bold">📌 إعداد Webhook في Meta:</p>
                <p>Callback URL: <code className="bg-blue-100 px-1 rounded">https://moslimleader.com/api/facebook/webhook</code></p>
                <p>Verify Token: قيمة <code className="bg-blue-100 px-1 rounded">FACEBOOK_WEBHOOK_VERIFY_TOKEN</code> في البيئة</p>
                <p>Subscribed Fields: <code className="bg-blue-100 px-1 rounded">messages, messaging_postbacks, feed</code></p>
              </div>
            </div>
          </SettingsSection>

          {/* Save button */}
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="w-full py-3 bg-[#F5C518] hover:bg-amber-400 text-gray-900 font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingSettings ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-black text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-emerald-500' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${checked ? 'left-[26px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function MessageCard({
  msg, conv, editingReply, actionLoading, onEditReply, onSend, onIgnore, onEscalate, onRegenerate,
}: {
  msg: Message & { source: string };
  conv: Conversation;
  editingReply: Record<string, string>;
  actionLoading: Record<string, boolean>;
  onEditReply: (id: string, val: string) => void;
  onSend: () => void;
  onIgnore: () => void;
  onEscalate: () => void;
  onRegenerate: () => void;
}) {
  const replyText = editingReply[msg.id] ?? msg.aiReply ?? '';
  const isLoading = actionLoading[msg.id];
  const isRegenerating = actionLoading[`regen-${msg.id}`];

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${msg.status === 'escalated' ? 'border-red-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#F5C518] flex items-center justify-center text-sm font-black text-[#1a1a2e] shrink-0">
            {(conv.senderName ?? conv.senderId).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-gray-900 truncate">
              {conv.senderName ?? `مستخدم ${conv.senderId.slice(-4)}`}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span>{msg.source === 'messenger' ? '💬 ماسنجر' : '🗨️ تعليق'}</span>
              <span>·</span>
              <span>{new Date(msg.createdAt).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {msg.aiIntent && (
            <span className="text-xs text-gray-500">{INTENT_AR[msg.aiIntent] ?? msg.aiIntent}</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[msg.status] ?? ''}`}>
            {STATUS_AR[msg.status] ?? msg.status}
          </span>
        </div>
      </div>

      {/* Incoming message */}
      <div className="bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm text-gray-700 leading-relaxed">
        {msg.text}
      </div>

      {/* Related product badge */}
      {msg.relatedProduct && (
        <div className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg inline-block">
          🛍️ {msg.relatedProduct}
        </div>
      )}

      {/* AI reply draft */}
      {msg.status !== 'ignored' && msg.status !== 'sent' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-600">✍️ الرد المقترح</label>
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1"
            >
              {isRegenerating ? '⏳' : '🔄'} إعادة التوليد
            </button>
          </div>
          <textarea
            value={replyText}
            onChange={e => onEditReply(msg.id, e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]/40 resize-none"
            placeholder={msg.aiReply ? '' : 'لم يتم توليد الرد بعد...'}
          />
        </div>
      )}

      {/* Sent reply */}
      {msg.status === 'sent' && msg.aiReply && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5 text-sm text-emerald-800 leading-relaxed">
          <span className="text-xs font-bold text-emerald-600 block mb-1">✅ الرد المُرسَل</span>
          {msg.aiReply}
        </div>
      )}

      {/* Escalation note */}
      {msg.status === 'escalated' && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700">
          🚨 هذه الرسالة تحتاج تدخلًا يدويًا — راجعها وتواصل مع العميل مباشرة.
        </div>
      )}

      {/* Actions */}
      {(msg.status === 'draft' || msg.status === 'failed') && (
        <div className="flex gap-2 flex-wrap pt-1">
          <button
            onClick={onSend}
            disabled={isLoading || !replyText.trim()}
            className="flex-1 py-2 bg-[#1a1a2e] hover:bg-[#2a2a4e] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40"
          >
            {isLoading ? '⏳ جاري الإرسال...' : '📤 إرسال'}
          </button>
          <button
            onClick={onEscalate}
            disabled={isLoading}
            className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-all disabled:opacity-40"
          >
            🚨 تصعيد
          </button>
          <button
            onClick={onIgnore}
            disabled={isLoading}
            className="px-3 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold rounded-xl transition-all disabled:opacity-40"
          >
            🗑️ تجاهل
          </button>
        </div>
      )}
    </div>
  );
}
