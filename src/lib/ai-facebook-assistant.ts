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

export type AiProvider = 'openai' | 'gemini' | 'anthropic';

export const AI_PROVIDERS: ReadonlyArray<{ key: AiProvider; label: string; help: string; getKeyUrl: string; defaultModel: string; models: Array<{ id: string; label: string }> }> = [
  {
    key: 'gemini',
    label: 'Google Gemini (مجاني 🆓)',
    help: 'مجاني تماماً — 15 طلب/دقيقة + 1500 طلب/يوم',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash',      label: 'gemini-2.0-flash (الموصى به، مجاني)' },
      { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite (الأرخص، مجاني)' },
      { id: 'gemini-2.5-flash',      label: 'gemini-2.5-flash (أحدث، مجاني)' },
      { id: 'gemini-2.5-pro',        label: 'gemini-2.5-pro (أعلى جودة، مدفوع)' },
      // Legacy alias kept for backward compatibility — points to whatever
      // Google currently maps "1.5-flash" to. May 404 in some regions.
      { id: 'gemini-1.5-flash-latest', label: 'gemini-1.5-flash-latest (legacy)' },
    ],
  },
  {
    key: 'openai',
    label: 'OpenAI ChatGPT (مدفوع)',
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
  {
    key: 'anthropic',
    label: 'Anthropic Claude (مدفوع، أفضل في العربي)',
    help: 'مدفوع — أفضل أداء في فهم النية والعربية الفصحى',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-haiku-4-5-20251001',
    models: [
      { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5 (سريع وأرخص)' },
      { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 (أعلى جودة)' },
      { id: 'claude-opus-4-7',            label: 'Claude Opus 4.7 (الأقوى)' },
    ],
  },
];

export interface AssistantApiKeys {
  openai?: string;
  gemini?: string;
  anthropic?: string;
}

export interface AssistantSettings {
  enabled: boolean;
  systemPrompt: string;
  // Which AI provider to call by default. Each provider has its own
  // API key; the active one is consulted at every webhook turn.
  provider: AiProvider;
  model: string;
  // Per-provider API keys, stored in the DB so the owner can manage
  // them from the admin UI without SSH-ing into the server. Each
  // key falls back to the matching env var (OPENAI_API_KEY,
  // GEMINI_API_KEY, ANTHROPIC_API_KEY) when not set here. NOT
  // returned by the GET endpoint as plaintext — only "configured?"
  // booleans surface to the UI.
  apiKeys: AssistantApiKeys;
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

const DEFAULT_SYSTEM_PROMPT = `أنت **أمين** — المساعد الذكي لمجتمع "مسلم ليدر" 🌟
مسلم ليدر مجتمع تربوي إسلامي متخصص في بناء شخصية الطفل المسلم من خلال كتب وألعاب ومنتجات تعليمية هادفة.
مهمتك مش بس الإجابة — مهمتك **تساعد كل أم تلاقي أنسب منتج لطفلها وتُغلق طلب فعلي** في كل محادثة.

## الرسالة الأولى — الترحيب بالمجتمع

لو الرسالة الأولى تحية أو استفسار عام بدون سياق سابق، رحّب بالعضو الجديد:
> "أهلاً وسهلاً بيك في مجتمع مسلم ليدر 🌟
> أنا أمين — مساعدك الشخصي لتلاقي أنسب منتج تربوي لطفلك بالظبط 💚
> كم طفل عندك وأعمارهم كام؟"

لو الرسالة فيها سؤال محدد (سعر / منتج / شحن)، انتقلي مباشرة للإجابة بدون ترحيب طويل.

## تدرّج المحادثة — اسأل سؤال واحد في كل رسالة

اتبع هذا التسلسل بالترتيب (تخطّ السؤال لو الإجابة موجودة بالفعل):

**خطوة 1 — عمر الطفل:**
"كم طفل عندك؟ وأعمارهم كام؟"
← بعد الإجابة، رشّح نوع المنتجات المناسبة للعمر ده.

**خطوة 2 — الجنس (لو مش واضح):**
"ولد ولا بنت؟"
← المنتجات في الـ context مُعلَّمة بـ 👦 للأولاد / 👧 للبنات / للجميع.
← لو فيه منتجات مناسبة للجنسين، اذكرها. لو مخصصة، رشّح اللي يناسب.

**خطوة 3 — العرض:**
رشّح **منتج واحد محدد** من الـ context:
> "أنسب حاجة لطفل [العمر] هي **[اسم المنتج]** — [جملة فايدة] — [السعر] ج.م."
> "شوف تفاصيله واطلبه مباشرة: [الرابط من الـ context]"

⚠️ **الرابط إلزامي** — استخدم الرابط الموجود في بيانات المنتج (يبدأ بـ https://moslimleader.com/shop/). لا تكتب رابط من عندك.
⚠️ لو المنتج مُعلَّم بـ "👨‍👩‍👧 يحتاج مشاركة الوالدين"، اذكر ده كميزة: "المنتج ده بيخلّيك تشاركه أوقات ممتعة مع طفلك".
⚠️ لا ترشّح أكتر من منتج في الرسالة الواحدة. الكثرة بتشتّت.

**خطوة 4 — الشحن:**
بعد اهتمام العميل، اسأل:
"أنت في مصر ولا بره مصر؟"
← **لو في مصر:** "في أنهي محافظة؟" ← استخرج سعر الشحن من قائمة الشحن في الـ context واذكره.
← **لو بره مصر:** "تواصل معنا على الموقع لمعرفة تكلفة الشحن الدولي: https://moslimleader.com"
← لو العميل بره مصر، اذكر أسعار المنتجات بالدولار (priceUsd) وليس بالجنيه.

**خطوة 5 — الإغلاق:**
"تحب أرتّبلك الطلب دلوقتي؟ ابعتلي اسمك، رقمك، ومحافظتك وأنا هخلّص الباقي 💚"

## التعامل مع الاعتراضات (Objection Handling)

| الاعتراض | الرد المقترح |
|---|---|
| "غالي / مكلف" | "أنا فاهماكِ. السعر ده بيشمل [قيمة المنتج]. وعندنا كوبون **[CODE]** بـ[DISCOUNT]% خصم لو طلبتي اليوم." |
| "هفكر / هرجعلك" | "تمام، المنتج لسه متوفر دلوقتي. لو حبيتي أحجزلك نسخة لحد ٢٤ ساعة — ابعتيلي اسمك بس." |
| "هتشاور جوزي / أمي" | "طبيعي جداً 😊 تحبي أبعتلك رابط المنتج تشاركيه معاهم؟" |
| "عندي كتب كتير بالفعل" | "بس المنتج ده مختلف لإنه [الفرق التربوي]. ممكن يبقى هدية مميزة لميلاد أو مناسبة." |
| "مش متأكدة المنتج هيعجبه" | "عندنا سياسة استبدال خلال 14 يوم لو ما عجبهوش — بدون أي رسوم إضافية." |

## استخدام الندرة والإثبات الاجتماعي (متى ما توفّر في الـ context)

- لو الـ context بيقول "متبقي X نسخ فقط" → اذكري الندرة: "متبقّي X نسخ بس دلوقتي ⚡".
- لو الـ context بيذكر عدد تقييمات منتج (⭐ X تقييم) → استخدمي: "اشترته أكتر من X أم — تقييمه ⭐X.X."
- لو فيه كوبون نشط → استخدميه في إغلاق صفقات الاعتراض السعري **فقط**.

## قواعد لازم تلتزمي بها

1. **اللغة:** عربية مصرية واضحة دافئة — مش رسمية ولا فجّة.
2. **الجنس:** التزمي بصيغة الجنس المحدّدة في "ما نعرفه عن العميل".
3. **الطول:** 3-5 جمل قصيرة. لا تكتبي فقرات طويلة.
4. **الدقة:** لا تخترعي منتج أو سعر أبداً. لو المنتج غير موجود في الـ context: "مش متوفر دلوقتي، بس عندنا [بدائل من القائمة]".
5. **الذاكرة:** لا تكرّري سؤال أنتِ عارفة إجابته من قسم "ما نعرفه عن العميل" (الأعمار، الموبايل، إلخ).
6. **الشخصنة:** لو الاسم معروف، استخدميه: "طيب يا فاطمة، …".
7. **العاطفة:** الأم بتشتري بالعقل والقلب — اربطي الفايدة التربوية ("هيتعلّم الصدق من القصص").
8. **الرابط:** كل ترشيح منتج لازم يشمل الرابط الحقيقي من الـ context — الرابط بيخلي فيسبوك يعرض صورة المنتج تلقائياً.
9. **الإغلاق المتدرّج:** لو ما رضيتش تشتري دلوقتي، اطلبي على الأقل رقم موبايل: "ابعتيلي رقمك علشان أبعتلك تذكير لما المنتج يبقى عليه عرض."

## بروتوكول التصنيف الإلزامي (System)

في **آخر سطر من كل رد** أضيفي وسمين مخفيين بالظبط (هيتم إزالتهم قبل الإرسال للعميل):

**LEAD حالة:**
- \`[[LEAD:HOT]]\`  أعطى رقم/عنوان، أو قال صراحة "أوكي هطلب"/"ابعتي"/"موافقة".
- \`[[LEAD:WARM]]\` سأل عن سعر/توفر/شحن/مقاس، أو فاوض، أو طلب مقارنة.
- \`[[LEAD:COLD]]\` تحية / سؤال عام / استفسار تربوي بدون نية شراء.

**INTENT (نوع السؤال) — اختاري واحد فقط:**
- \`[[INTENT:price-question]]\`     سؤال سعر مباشر.
- \`[[INTENT:shipping-question]]\`  سؤال شحن أو توصيل.
- \`[[INTENT:ready-to-buy]]\`       جاهز يقفل صفقة.
- \`[[INTENT:objection]]\`          اعتراض (سعر، تفكير، تشاور).
- \`[[INTENT:general]]\`            تحية أو استفسار عام.

**مثال تسلسل صحيح:**

رسالة 1 (عميل): "عاوز منتج لطفلي"
رد 1: "أهلاً! 😊 كم عمر طفلك؟"

رسالة 2: "6 سنين"
رد 2: "تمام، ولد ولا بنت؟"

رسالة 3: "ولد"
رد 3: "أنسب حاجة لطفل 6 سنين ولد هي **لعبة يوم الصائم** — بتعلّمه الصيام بأسلوب مرح — 280 ج.م.
شوف تفاصيلها: https://moslimleader.com/shop/saim-game
أنت في مصر ولا بره مصر؟ [[LEAD:WARM]] [[INTENT:general]]"

رسالة 4: "في القاهرة"
رد 4: "تمام! الشحن على القاهرة بـ[X] ج.م ويوصلك خلال 2-5 أيام.
ابعتلي اسمك ورقمك وأنا هخلّص الطلب 💚 [[LEAD:HOT]] [[INTENT:ready-to-buy]]"

ابدأي الآن.`;

const DEFAULTS: AssistantSettings = {
  enabled: false,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  apiKeys: {},
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
    // Defensive merge: a Setting saved BEFORE the apiKeys field
    // existed will spread `apiKeys: undefined` over DEFAULTS.apiKeys,
    // wiping the empty-object default. Force apiKeys to always be an
    // object so downstream `settings.apiKeys.openai` never throws.
    const merged = { ...DEFAULTS, ...parsed } as AssistantSettings;
    if (!merged.apiKeys || typeof merged.apiKeys !== 'object') {
      merged.apiKeys = {};
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}

export async function saveAssistantSettings(input: Partial<AssistantSettings>): Promise<AssistantSettings> {
  const current = await getAssistantSettings();
  const VALID: AiProvider[] = ['openai', 'gemini', 'anthropic'];
  const provider: AiProvider =
    typeof input.provider === 'string' && (VALID as string[]).includes(input.provider)
      ? input.provider as AiProvider
      : current.provider;

  // Merge keys instead of replacing — the UI sends only the keys
  // the user actually changed (empty string = no change). Use the
  // sentinel value '__CLEAR__' to delete a stored key.
  const inKeys = (input.apiKeys ?? {}) as AssistantApiKeys;
  const apiKeys: AssistantApiKeys = { ...current.apiKeys };
  for (const k of ['openai', 'gemini', 'anthropic'] as const) {
    const raw = inKeys[k];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed === '') continue; // empty = leave as-is
    if (trimmed === '__CLEAR__') { delete apiKeys[k]; continue; }
    apiKeys[k] = trimmed;
  }

  const next: AssistantSettings = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
    systemPrompt: typeof input.systemPrompt === 'string' && input.systemPrompt.trim()
      ? input.systemPrompt.trim()
      : current.systemPrompt,
    provider,
    model: typeof input.model === 'string' && input.model.trim() ? input.model.trim() : current.model,
    apiKeys,
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
//
// Argument order (provider, keys, input) reads naturally as
// "with THIS provider, using THESE keys, generate from THIS input".
// `keys` is optional — providers fall back to env vars when no
// explicit key is supplied.
export async function callAi(
  provider: AiProvider,
  keys: AssistantApiKeys | undefined,
  input: AiCallInput,
): Promise<AiCallResult> {
  const k = keys ?? {};
  switch (provider) {
    case 'gemini':    return callGemini(input, k.gemini);
    case 'anthropic': return callAnthropic(input, k.anthropic);
    case 'openai':
    default:          return callOpenAI(input, k.openai);
  }
}

// Direct fetch to OpenAI Chat Completions endpoint — no SDK needed.
// Works with any OpenAI-compatible provider (Azure OpenAI, Together,
// etc.) by setting OPENAI_BASE_URL.
export async function callOpenAI(input: AiCallInput, keyOverride?: string): Promise<AiCallResult> {
  const apiKey = keyOverride || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح OpenAI غير مُهيّأ — أضفه من صفحة المساعد أو OPENAI_API_KEY في .env');
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
export async function callGemini(input: AiCallInput, keyOverride?: string): Promise<AiCallResult> {
  const apiKey = keyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح Gemini غير مُهيّأ — أضفه من صفحة المساعد أو GEMINI_API_KEY في .env');
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

// Anthropic Claude — direct fetch to the Messages API. No SDK needed.
// Best Arabic comprehension of the three providers, billed per token
// like OpenAI. Get a key at https://console.anthropic.com/settings/keys.
export async function callAnthropic(input: AiCallInput, keyOverride?: string): Promise<AiCallResult> {
  const apiKey = keyOverride || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح Anthropic غير مُهيّأ — أضفه من صفحة المساعد أو ANTHROPIC_API_KEY في .env');
  }

  // Anthropic expects messages to alternate user/assistant; consecutive
  // same-role messages get rejected. Filter the history accordingly.
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const turn of input.history ?? []) {
    if (messages.length > 0 && messages[messages.length - 1].role === turn.role) continue;
    messages.push({ role: turn.role, content: turn.content });
  }
  // Last message must be from the user.
  if (messages.length > 0 && messages[messages.length - 1].role !== 'user') {
    messages.pop();
  }
  messages.push({ role: 'user', content: input.userMessage });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: input.model,
      system: input.systemPrompt,
      messages,
      max_tokens: input.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json() as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = data?.content?.filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim() ?? '';
  const totalTokens = (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0);
  if (!text) throw new Error('Anthropic returned empty response');
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

// Parse the [[LEAD:HOT|WARM|COLD]] and [[INTENT:...]] tags the bot
// appends to every reply. Returns the cleaned text (both tags
// stripped) plus the parsed values. Defaults: lead='cold',
// intent=null when the model forgets to emit a tag.
export type IntentTag = 'price-question' | 'shipping-question' | 'ready-to-buy' | 'objection' | 'general';

export function extractLeadTag(rawText: string): {
  cleanText: string;
  leadStatus: 'hot' | 'warm' | 'cold';
  intent: IntentTag | null;
} {
  const leadRe   = /\[\[\s*LEAD\s*:\s*(HOT|WARM|COLD)\s*\]\]/i;
  const intentRe = /\[\[\s*INTENT\s*:\s*(price-question|shipping-question|ready-to-buy|objection|general)\s*\]\]/i;

  const leadMatch   = rawText.match(leadRe);
  const intentMatch = rawText.match(intentRe);

  const leadStatus = (leadMatch?.[1]?.toLowerCase() ?? 'cold') as 'hot' | 'warm' | 'cold';
  const intent     = (intentMatch?.[1]?.toLowerCase() ?? null) as IntentTag | null;

  const cleaned = rawText
    .replace(leadRe,   '')
    .replace(intentRe, '')
    .replace(/\s+$/u, '')
    .trim();

  return { cleanText: cleaned, leadStatus, intent };
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

// Fetch the Facebook user's country code from their profile locale.
// locale format from Graph API: "ar_SA" → "SA", "ar_EG" → "EG".
// Result is cached in Setting table (key: fb-country-{psid}) so we
// only call the Graph API once per user, not on every message.
export async function fetchUserCountryCode(psid: string): Promise<string> {
  try {
    const cached = await prisma.setting.findUnique({
      where: { key: `fb-country-${psid}` },
    });
    if (typeof cached?.value === 'string' && cached.value.length === 2) {
      return cached.value.toUpperCase();
    }
  } catch { /* fall through to API call */ }

  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageToken || pageToken === 'PENDING') return 'EG';

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(psid)}?fields=locale&access_token=${encodeURIComponent(pageToken)}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return 'EG';
    const data = await res.json() as { locale?: string };
    // "ar_SA" → "SA", fallback to "EG"
    const cc = (data.locale?.split('_')[1] ?? 'EG').toUpperCase();
    await prisma.setting.upsert({
      where: { key: `fb-country-${psid}` },
      create: { key: `fb-country-${psid}`, value: cc },
      update: { value: cc },
    }).catch(() => { /* non-critical */ });
    return cc;
  } catch {
    return 'EG';
  }
}
