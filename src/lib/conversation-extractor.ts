import { prisma } from './prisma';

// Pulls structured signals (name, phone, address, kids' ages,
// intent) out of a free-text conversation. Two-stage:
//   1. Fast regex pass — catches the 80% case (Egyptian phone
//      numbers, obvious "I want to order" phrases).
//   2. AI fallback (optional) for messages that look like buying
//      signals but didn't yield a phone — extracts a structured
//      JSON object via the configured assistant provider. Cached
//      per psid so we don't double-bill.
//
// Result merges into a per-psid profile stored in the Setting
// table under `fb-profile:<psid>` so subsequent webhook turns
// can read accumulated knowledge without re-scanning history.

export interface CustomerProfile {
  name: string | null;
  phone: string | null;
  address: string | null;
  governorate: string | null;
  kidAges: number[];   // [3, 5, 7] — empty array when none discovered
  intentSignal: IntentSignal | null;
  // Bookkeeping — last time we updated this profile (so the
  // analytics card can show "X new HOT leads in the last 24h").
  updatedAt: string;
}

export type IntentSignal =
  | 'price-question'
  | 'shipping-question'
  | 'ready-to-buy'
  | 'objection'
  | 'general';

const PROFILE_KEY_PREFIX = 'fb-profile:';
const PROFILE_TTL_MS = 60 * 60 * 1000; // 1h cached in-memory
const profileCache = new Map<string, { at: number; profile: CustomerProfile }>();

const EMPTY_PROFILE = (): CustomerProfile => ({
  name: null,
  phone: null,
  address: null,
  governorate: null,
  kidAges: [],
  intentSignal: null,
  updatedAt: new Date(0).toISOString(),
});

// ── Egyptian phone matcher ──
// 010 / 011 / 012 / 015 followed by 8 digits. Tolerates spaces,
// dashes, and a leading +20 / 0020 / 20.
const PHONE_RE = /(?:\+?20|0020)?\s*0?\s*(1[0125])[\s-]*(\d{4})[\s-]*(\d{4})/g;

// Common governorate names (Arabic, ~28 governorates + variants).
// Used as a quick lookup; if the message contains any of these we
// flag the governorate. Not exhaustive on purpose — a missing one
// just means the field stays null.
const GOVERNORATES: Array<{ key: string; aliases: string[] }> = [
  { key: 'القاهرة',     aliases: ['القاهرة', 'القاهره', 'cairo'] },
  { key: 'الجيزة',      aliases: ['الجيزة', 'الجيزه', 'giza'] },
  { key: 'الإسكندرية',  aliases: ['الاسكندرية', 'الإسكندرية', 'اسكندرية', 'alex'] },
  { key: 'الدقهلية',    aliases: ['الدقهلية', 'المنصورة', 'منصورة'] },
  { key: 'الشرقية',     aliases: ['الشرقية', 'الزقازيق', 'زقازيق'] },
  { key: 'الغربية',     aliases: ['الغربية', 'طنطا', 'المحلة', 'محلة'] },
  { key: 'القليوبية',   aliases: ['القليوبية', 'بنها', 'شبرا الخيمة', 'شبرا'] },
  { key: 'كفر الشيخ',   aliases: ['كفر الشيخ'] },
  { key: 'البحيرة',     aliases: ['البحيرة', 'دمنهور'] },
  { key: 'المنوفية',    aliases: ['المنوفية', 'شبين الكوم'] },
  { key: 'دمياط',       aliases: ['دمياط'] },
  { key: 'بورسعيد',     aliases: ['بورسعيد'] },
  { key: 'الإسماعيلية', aliases: ['الإسماعيلية', 'الاسماعيلية', 'اسماعيلية'] },
  { key: 'السويس',      aliases: ['السويس'] },
  { key: 'شمال سيناء',  aliases: ['شمال سيناء', 'العريش'] },
  { key: 'جنوب سيناء',  aliases: ['جنوب سيناء', 'شرم الشيخ', 'شرم'] },
  { key: 'البحر الأحمر', aliases: ['البحر الاحمر', 'البحر الأحمر', 'الغردقة', 'غردقة'] },
  { key: 'الفيوم',      aliases: ['الفيوم'] },
  { key: 'بني سويف',    aliases: ['بني سويف'] },
  { key: 'المنيا',      aliases: ['المنيا'] },
  { key: 'أسيوط',       aliases: ['أسيوط', 'اسيوط'] },
  { key: 'سوهاج',       aliases: ['سوهاج'] },
  { key: 'قنا',         aliases: ['قنا'] },
  { key: 'الأقصر',      aliases: ['الأقصر', 'الاقصر', 'luxor'] },
  { key: 'أسوان',       aliases: ['أسوان', 'اسوان', 'aswan'] },
  { key: 'الوادي الجديد', aliases: ['الوادي الجديد', 'الخارجة'] },
  { key: 'مطروح',       aliases: ['مطروح', 'مرسى مطروح'] },
];

// Buying-intent phrases (Arabic + Egyptian colloquial). When ANY
// match, intent is 'ready-to-buy' regardless of other signals.
const READY_TO_BUY_PHRASES = [
  'عاوزة اطلب', 'عاوز اطلب', 'هطلب', 'حابة اطلب', 'بدي اطلب',
  'اوكي هطلب', 'تمام هطلب', 'موافقة', 'موافق', 'يلا اطلب',
  'ابعتيلي', 'ابعتلي', 'خدي بياناتي', 'خد بياناتي',
];

const PRICE_PHRASES = [
  'بكام', 'بكم', 'السعر', 'سعرها', 'سعره', 'كام السعر',
  'كم السعر', 'price', 'كام تمنه', 'كام تمنها',
];

const SHIPPING_PHRASES = [
  'الشحن', 'التوصيل', 'بيوصل', 'بتوصل', 'مدة الشحن',
  'shipping', 'delivery', 'هيوصل امتى', 'كام يوم',
];

const OBJECTION_PHRASES = [
  'غالي', 'مكلف', 'كتير', 'افكر', 'هتشاور', 'هسأل جوزي',
  'هرجعلك', 'مش متأكدة', 'مش متاكد',
];

// ── Kid-age parsing ──
// Patterns like "عمره 5", "عمرها 7 سنين", "ابني عنده 4",
// "عندي طفلين 5 و 8", etc.
const KID_AGE_RE = /(?:عمر[ها]?|عنده?[ها]?|ابني|بنتي|طفل[ةى]?|اطفال[ي]?)[^0-9]{0,30}(\d{1,2})/gu;

// ── Name extraction (rough) ──
// "اسمي فاطمة" / "انا فاطمة" / "Hi I'm Sarah".
const NAME_RE = /(?:اسمي|انا|أنا|i'm|im|name is)[\s,،]+([^\d\n،.]{2,30}?)(?:[\s,،.]|$)/iu;

export function extractFromMessage(message: string): Partial<CustomerProfile> {
  const out: Partial<CustomerProfile> = {};
  const lower = message.toLowerCase();

  // Phone — first match only.
  PHONE_RE.lastIndex = 0;
  const phoneMatch = PHONE_RE.exec(message);
  if (phoneMatch) {
    const digits = `0${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
    if (digits.length === 11) out.phone = digits;
  }

  // Governorate.
  for (const g of GOVERNORATES) {
    if (g.aliases.some(a => lower.includes(a.toLowerCase()))) {
      out.governorate = g.key;
      break;
    }
  }

  // Address heuristic — look for "العنوان" or "العنوان شارع".
  const addrMatch = message.match(/(?:العنوان|العنوان[\s:،])\s*([^\n]{5,200})/u);
  if (addrMatch) out.address = addrMatch[1].trim();

  // Kid ages — collect all matches, dedupe, clamp 0-18.
  KID_AGE_RE.lastIndex = 0;
  const ages: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = KID_AGE_RE.exec(message)) !== null) {
    const age = parseInt(m[1], 10);
    if (age >= 0 && age <= 18 && !ages.includes(age)) ages.push(age);
  }
  if (ages.length > 0) out.kidAges = ages;

  // Name.
  const nameMatch = message.match(NAME_RE);
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    // Reject obvious non-names (numbers, very short, common words).
    if (candidate.length >= 2 && candidate.length <= 30 && !/^\d/.test(candidate)) {
      out.name = candidate;
    }
  }

  // Intent — checked in priority order.
  if (READY_TO_BUY_PHRASES.some(p => lower.includes(p))) {
    out.intentSignal = 'ready-to-buy';
  } else if (PRICE_PHRASES.some(p => lower.includes(p))) {
    out.intentSignal = 'price-question';
  } else if (SHIPPING_PHRASES.some(p => lower.includes(p))) {
    out.intentSignal = 'shipping-question';
  } else if (OBJECTION_PHRASES.some(p => lower.includes(p))) {
    out.intentSignal = 'objection';
  } else if (out.phone || out.address) {
    // Phone+address without explicit "I want to order" still counts
    // as buying intent — the customer wouldn't share contact info
    // for a casual chat.
    out.intentSignal = 'ready-to-buy';
  } else {
    out.intentSignal = 'general';
  }

  return out;
}

// Persist + return the merged profile for a psid. Reads the
// existing Setting row, merges new fields (only overwrites when
// the new value is non-null), writes back, returns the result.
export async function updateProfile(
  psid: string,
  newSignals: Partial<CustomerProfile>,
): Promise<CustomerProfile> {
  const existing = await getProfile(psid);
  const merged: CustomerProfile = {
    name:         newSignals.name         ?? existing.name,
    phone:        newSignals.phone        ?? existing.phone,
    address:      newSignals.address      ?? existing.address,
    governorate:  newSignals.governorate  ?? existing.governorate,
    kidAges:      newSignals.kidAges && newSignals.kidAges.length > 0
                    ? newSignals.kidAges
                    : existing.kidAges,
    // Intent always reflects the LATEST signal — it's a per-message
    // classification, not an accumulator.
    intentSignal: newSignals.intentSignal ?? existing.intentSignal,
    updatedAt:    new Date().toISOString(),
  };
  await prisma.setting.upsert({
    where:  { key: PROFILE_KEY_PREFIX + psid },
    create: { key: PROFILE_KEY_PREFIX + psid, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  profileCache.set(psid, { at: Date.now(), profile: merged });
  return merged;
}

export async function getProfile(psid: string): Promise<CustomerProfile> {
  const cached = profileCache.get(psid);
  if (cached && Date.now() - cached.at < PROFILE_TTL_MS) return cached.profile;
  try {
    const row = await prisma.setting.findUnique({ where: { key: PROFILE_KEY_PREFIX + psid } });
    if (!row?.value) return EMPTY_PROFILE();
    const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    const profile: CustomerProfile = { ...EMPTY_PROFILE(), ...parsed };
    if (!Array.isArray(profile.kidAges)) profile.kidAges = [];
    profileCache.set(psid, { at: Date.now(), profile });
    return profile;
  } catch {
    return EMPTY_PROFILE();
  }
}

// Render the profile as a short Arabic block to inject into the
// system prompt so the bot uses what we already know about the
// buyer (don't ask their name twice, don't ask kid ages we have).
export function renderProfileForPrompt(p: CustomerProfile): string {
  const lines: string[] = ['## ما نعرفه عن العميل حالياً:'];
  if (p.name)         lines.push(`- الاسم: ${p.name}`);
  if (p.phone)        lines.push(`- الموبايل: ${p.phone}  (لا تطلبه مرة أخرى)`);
  if (p.address)      lines.push(`- العنوان: ${p.address}`);
  if (p.governorate)  lines.push(`- المحافظة: ${p.governorate}`);
  if (p.kidAges.length > 0) {
    lines.push(`- أعمار الأطفال: ${p.kidAges.join('، ')} سنة  (لا تسأل عن الأعمار مرة أخرى)`);
  }
  if (p.intentSignal) {
    const labels: Record<IntentSignal, string> = {
      'price-question':    'سأل عن السعر',
      'shipping-question': 'سأل عن الشحن',
      'ready-to-buy':      'جاهز يطلب الآن — اقترب من إغلاق الطلب',
      'objection':         'عبّر عن اعتراض — تعامل معه قبل العرض',
      'general':           'استفسار عام',
    };
    lines.push(`- آخر نية ملاحظة: ${labels[p.intentSignal]}`);
  }
  if (lines.length === 1) return ''; // nothing known yet
  return lines.join('\n');
}
