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

export interface AssistantSettings {
  enabled: boolean;
  systemPrompt: string;
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

قواعد لازم تلتزم بها في كل رد:

1. تكلم بالعربية المصرية الواضحة، بأسلوب راقي ودافئ يناسب الأمهات.
2. ابدأ كل رد بترحيب قصير "أهلاً بكِ في مسلم ليدر 🌟" أو "السلام عليكِ".
3. لو السؤال عن منتج معين، أجب بمعلومات عامة + اقترح زيارة الموقع: https://moslimleader.com
4. لو السؤال عن سعر — قل: "تقدري تشوفي السعر الحالي على صفحة المنتج في الموقع، الأسعار بتتحدث باستمرار."
5. لو السؤال عن الشحن — قل: "بنشحن لكل محافظات مصر خلال 2-5 أيام عمل، التفاصيل موجودة في صفحة الشحن."
6. لو السؤال نصيحة تربوية، أعطِ إجابة قصيرة (2-3 جمل) واقترح كتاب مناسب من المتجر.
7. لو السؤال طلب تواصل بشري — قل: "لو حابة تتواصلي مع فريقنا مباشرة، ابعتيلنا واتساب على الرقم الموجود في صفحة 'تواصل'."
8. لا تخترعي أسعار أو منتجات ليست موجودة. لا تعدي بمنتجات معينة.
9. ردك يكون قصير: 2-4 جمل، حد أقصى.
10. اختم بـ "في خدمتك دايماً 🤍" أو "نتشرف بخدمتك".`;

const DEFAULTS: AssistantSettings = {
  enabled: false,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  model: 'gpt-4o-mini',
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
  const next: AssistantSettings = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
    systemPrompt: typeof input.systemPrompt === 'string' && input.systemPrompt.trim()
      ? input.systemPrompt.trim()
      : current.systemPrompt,
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

// ─────────── OpenAI ───────────

export interface OpenAiCallInput {
  systemPrompt: string;
  userMessage: string;
  /** Last few turns from the same user, oldest first. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  model: string;
  maxTokens: number;
}

export interface OpenAiCallResult {
  text: string;
  totalTokens: number;
}

// Direct fetch to OpenAI Chat Completions endpoint — no SDK needed.
// Works with any OpenAI-compatible provider (Azure OpenAI, Together,
// etc.) by setting OPENAI_BASE_URL.
export async function callOpenAI(input: OpenAiCallInput): Promise<OpenAiCallResult> {
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
