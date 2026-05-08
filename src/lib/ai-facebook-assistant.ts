import crypto from 'crypto';
import { prisma } from './prisma';

// AI Facebook Assistant — central library for:
// 1. Reading/writing assistant settings (persisted in Setting table)
// 2. Verifying Facebook webhook signatures
// 3. Calling OpenAI for a reply
// 4. Sending replies via the Facebook Send API
//
// Used by:
// - /api/facebook/webhook (POST handler) — auto-reply path
// - /api/admin/ai-facebook-assistant — admin UI

export type AiProvider = 'openai' | 'gemini';

export interface AssistantSettings {
  enabled: boolean;
  systemPrompt: string;
  // Which AI provider to call. 'gemini' uses Google's free tier
  // (GEMINI_API_KEY); 'openai' uses OPENAI_API_KEY (paid).
  provider: AiProvider;
  model: string;
  // Optional restriction: only auto-reply if the message contains
  // certain keywords (asks about products / prices / shipping, etc).
  // Empty array = reply to everything when enabled.
  triggerKeywords: string[];
  // Maximum reply length in tokens. Keeps replies snappy + caps cost.
  maxTokens: number;
  // Last time the admin tweaked the settings. Surfaced in the UI so
  // owner knows when the prompt was last reviewed.
  updatedAt: string;
}

const DEFAULT_SYSTEM_PROMPT = `أنت المساعد الذكي لمتجر "مسلم ليدر" — متجر تربوي إسلامي للأطفال يبيع كتب وألعاب وحقائب مدرسية ومنتجات تعليمية.

دورك ليس مجرد رد على الأسئلة — أنت **بائع استشاري** هدفك الأهم:
أ) فهم احتياج العميل بدقة (عدد الأطفال، أعمارهم، اهتماماتهم).
ب) ترشيح منتجات محددة من المتجر تناسبهم بالضبط.
ج) دفع المحادثة لإغلاق الطلب (الحصول على رقم تواصل أو تأكيد الشراء).

أسلوب المحادثة:
1. ابدأ بترحيب قصير دافئ.
2. **اسأل عن الأطفال أولاً** قبل أن ترشّح أي منتج: "كم طفل عندك؟ وما أعمارهم؟ وأكثر شيء بيحبوه؟". لا تتجاوز هذه الخطوة.
3. بعد ما تعرف الأعمار، رشّح **منتج واحد أو اثنين بالحد الأقصى** من القائمة المذكورة في الـ context — اذكر الاسم والسعر والرابط بالضبط.
4. اختم برسالة محفّزة لإغلاق الطلب: "تحبي تطلبيها دلوقتي؟ ابعتيلي رقمك والعنوان وأنا هرتبلك الطلب."
5. كل رد لا يتعدى 4-5 جمل قصيرة. لا تكتب فقرات طويلة.
6. لا تخترع أبداً منتج أو سعر غير موجود في الـ context. لو السؤال عن منتج غير متوفر، قل: "مش متوفر حالياً، بس عندنا [بدائل من القائمة]".

قواعد متابعة:
- لو العميل أعطاك رقم تليفون أو عنوان: قل "تمام، فريقنا هيتواصل معك للتأكيد خلال ساعة" واطلب تأكيد المنتج المراد.
- لو طلب التواصل بفريق بشري: قل "لو حابة، ابعتي على واتساب الرقم الظاهر في صفحة الموقع."
- لو السؤال نصيحة تربوية: أعطِ نصيحة قصيرة جداً (جملة-جملتين) واربطها بكتاب من المكتبة لو فيه واحد مناسب.

⚠️ بروتوكول التصنيف الإلزامي (System):
في **آخر سطر من كل رد** أضف وسم تصنيف مخفي بالشكل الآتي بالظبط (سيتم إزالته قبل إرسال الرد للعميل، استخدمه دائماً):

[[LEAD:HOT]]   إذا كان العميل: أعطاك رقم تليفون، أو عنوان، أو قال صراحة "أوكي هطلب" / "ابعتي" / "اتواصلوا معايا".
[[LEAD:WARM]]  إذا كان العميل: سأل عن سعر منتج محدد، عن توفّر، عن الشحن، عن الحجم/المقاس، أو فاوض على السعر.
[[LEAD:COLD]]  أي حالة أخرى: تحية، سؤال عام، استفسار تربوي بدون نية شراء.

مثال على الرد الصحيح:
"أهلاً بكِ في مسلم ليدر 🌟
عندك كم طفل وأعمارهم كام؟ عشان أرشّحلك المناسب لكل واحد فيهم.
[[LEAD:COLD]]"

ابدأ الآن.`;

const DEFAULTS: AssistantSettings = {
  enabled: false,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  // Default to Gemini (free tier) so the bot works without paid setup.
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  triggerKeywords: [],
  maxTokens: 300,
  updatedAt: new Date(0).toISOString(),
};

const SETTINGS_KEY = 'ai-facebook-assistant';

export async function getAssistantSettings(): Promise<AssistantSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row?.value) return DEFAULTS;
    const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export async function saveAssistantSettings(input: Partial<AssistantSettings>): Promise<AssistantSettings> {
  const current = await getAssistantSettings();
  const provider: AiProvider =
    input.provider === 'openai' || input.provider === 'gemini'
      ? input.provider
      : current.provider;
  const next: AssistantSettings = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
    systemPrompt: typeof input.systemPrompt === 'string' && input.systemPrompt.trim()
      ? input.systemPrompt.trim()
      : current.systemPrompt,
    provider,
    model: typeof input.model === 'string' && input.model.trim() ? input.model.trim() : current.model,
    triggerKeywords: Array.isArray(input.triggerKeywords)
      ? input.triggerKeywords.filter(k => typeof k === 'string' && k.trim().length > 0).map(k => k.trim())
      : current.triggerKeywords,
    maxTokens: typeof input.maxTokens === 'number' && input.maxTokens > 0
      ? Math.min(2000, Math.floor(input.maxTokens))
      : current.maxTokens,
    updatedAt: new Date().toISOString(),
  };
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

// ─────────── Webhook signature verification ───────────

// Facebook signs every POST with HMAC-SHA256(payload, app_secret).
// We must verify before trusting any event — otherwise anyone with
// our webhook URL could spam fake messages and get the AI to reply.
export function verifyFacebookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const appSecret = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    // No secret configured — fail closed in production. In dev let it
    // pass so local testing without an .env doesn't drop events.
    return process.env.NODE_ENV !== 'production';
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  // Constant-time compare to defeat timing attacks.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─────────── AI providers ───────────

export interface AiCallInput {
  systemPrompt: string;
  userMessage: string;
  /** Last few turns from the same user, oldest first. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  model: string;
  maxTokens: number;
}

export interface AiCallResult {
  text: string;
  totalTokens: number;
}

// Backward-compatible aliases — older code imports these names.
export type OpenAiCallInput = AiCallInput;
export type OpenAiCallResult = AiCallResult;

// Provider-agnostic entry point. The webhook + admin endpoints call
// this so adding a new provider is a one-line switch case below.
export async function callAi(provider: AiProvider, input: AiCallInput): Promise<AiCallResult> {
  switch (provider) {
    case 'gemini': return callGemini(input);
    case 'openai':
    default:       return callOpenAI(input);
  }
}

// Direct fetch to OpenAI Chat Completions endpoint — no SDK needed.
// Works with any OpenAI-compatible provider (Azure OpenAI, Together,
// etc.) by setting OPENAI_BASE_URL.
export async function callOpenAI(input: AiCallInput): Promise<AiCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY غير مهيّأ في متغيرات البيئة');
  }
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  const messages = [
    { role: 'system' as const, content: input.systemPrompt },
    ...(input.history ?? []),
    { role: 'user' as const, content: input.userMessage },
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages,
      max_tokens: input.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const text = data?.choices?.[0]?.message?.content?.trim() ?? '';
  const totalTokens = data?.usage?.total_tokens ?? 0;
  if (!text) throw new Error('OpenAI returned empty response');
  return { text, totalTokens };
}

// Google Gemini via the public Generative Language API. The free
// tier is the reason we default to this — `gemini-1.5-flash` allows
// 15 RPM / 1M tokens/day at no cost. Get a key at https://ai.google.dev.
export async function callGemini(input: AiCallInput): Promise<AiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY غير مهيّأ في متغيرات البيئة');
  }

  // Gemini uses an alternating-roles format. Convert our generic
  // history (user/assistant) into Gemini's (user/model) shape.
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const turn of input.history ?? []) {
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: input.userMessage }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: input.maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim() ?? '';
  const totalTokens = data?.usageMetadata?.totalTokenCount ?? 0;
  if (!text) throw new Error('Gemini returned empty response');
  return { text, totalTokens };
}

// ─────────── Facebook Send API ───────────

export interface FacebookSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendFacebookReply(recipientPsid: string, text: string): Promise<FacebookSendResult> {
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageToken || pageToken === 'PENDING') {
    return { ok: false, error: 'FB_PAGE_ACCESS_TOKEN غير مهيّأ' };
  }
  // Trim to Messenger's 2000-char ceiling.
  const safeText = text.slice(0, 1990);
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  const body = {
    recipient: { id: recipientPsid },
    message: { text: safeText },
    messaging_type: 'RESPONSE',
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(data).slice(0, 300) };
    }
    return { ok: true, messageId: (data as { message_id?: string }).message_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Toggle the "is typing..." dots in Messenger. Called BEFORE the AI
// runs so the user sees activity within a fraction of a second
// (otherwise they sit watching nothing for 1-3s while the model
// generates). Typing auto-clears when the next message goes out or
// after ~20 seconds.
export async function sendTypingIndicator(recipientPsid: string, on: boolean): Promise<void> {
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageToken || pageToken === 'PENDING') return;
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        sender_action: on ? 'typing_on' : 'typing_off',
      }),
    });
  } catch {
    // Typing indicator is cosmetic — never fail a reply because of it.
  }
}

// Compute a human-like delay (ms) based on reply length. Roughly
// mirrors a person typing ~60 wpm, capped at 6 seconds so the user
// doesn't wait too long. Used after the AI returns to make the bot
// feel less robotic.
export function humanizeDelay(replyText: string): number {
  const words = replyText.split(/\s+/).length;
  const ms = Math.min(6000, Math.max(1500, words * 80));
  return ms;
}

// Reply to a Page comment via Graph API. Different endpoint than
// Messenger DMs — comments are public, posted as a child of the
// original comment so the user's notification chains correctly.
// Required permissions: `pages_manage_engagement` (production) +
// `pages_read_engagement`.
export async function replyToComment(commentId: string, text: string): Promise<FacebookSendResult> {
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageToken || pageToken === 'PENDING') {
    return { ok: false, error: 'FB_PAGE_ACCESS_TOKEN غير مهيّأ' };
  }
  const safeText = text.slice(0, 7990); // FB allows 8000 chars on comments
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}/comments?access_token=${encodeURIComponent(pageToken)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: safeText }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(data).slice(0, 300) };
    }
    return { ok: true, messageId: (data as { id?: string }).id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Parse the [[LEAD:HOT|WARM|COLD]] tag the bot appends to every reply.
// Returns the cleaned text (tag stripped) plus the lead status. The
// tag format is enforced by the system prompt; if the model forgets
// to add one, we default to 'cold'.
export function extractLeadTag(rawText: string): { cleanText: string; leadStatus: 'hot' | 'warm' | 'cold' } {
  // Match [[LEAD:HOT]] / [[LEAD:WARM]] / [[LEAD:COLD]] anywhere — tolerate
  // whitespace + Arabic punctuation around it.
  const re = /\[\[\s*LEAD\s*:\s*(HOT|WARM|COLD)\s*\]\]/i;
  const match = rawText.match(re);
  const status = (match?.[1]?.toLowerCase() ?? 'cold') as 'hot' | 'warm' | 'cold';
  // Strip the tag AND any trailing whitespace/newlines it left behind.
  const cleaned = rawText
    .replace(re, '')
    .replace(/\s+$/u, '')
    .trim();
  return { cleanText: cleaned, leadStatus: status };
}

// Decide whether to auto-reply to an incoming message based on
// settings. Pure function — no I/O so it's cheap to call inside the
// hot path of the webhook handler.
export function shouldAutoReply(message: string, settings: AssistantSettings): boolean {
  if (!settings.enabled) return false;
  if (!message || message.trim().length === 0) return false;
  if (settings.triggerKeywords.length === 0) return true;
  const lower = message.toLowerCase();
  return settings.triggerKeywords.some(k => lower.includes(k.toLowerCase()));
}
