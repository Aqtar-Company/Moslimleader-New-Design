/**
 * International Shipping — zones, countries, prices
 * Prices are approximate Egypt Post / Aramex defaults from Egypt.
 * All values are editable from the admin dashboard.
 *
 * Zones (from Egypt):
 *   saudi    → Saudi Arabia              (SAR)
 *   gulf     → AE, KW, QA, BH, OM       (USD)
 *   arab     → Arab world ex-Gulf        (USD)
 *   europe   → Europe + Turkey           (USD)
 *   americas → Americas + AU + NZ        (USD)
 *   asia     → Asia / South-East Asia    (USD)
 *   africa   → Sub-Saharan Africa        (USD)
 *   rest     → Everywhere else           (USD) — fallback
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShippingZone = 'saudi' | 'gulf' | 'arab' | 'europe' | 'americas' | 'asia' | 'africa' | 'rest';

export interface Country {
  code: string;
  nameAr: string;
  nameEn: string;
  zone: ShippingZone;
  blockedByDefault?: boolean;
}

export interface WeightBracket {
  id: string;
  minKg: number;
  maxKg: number;
  labelAr: string;
}

export interface ZonePricing {
  zone: ShippingZone;
  nameAr: string;
  currency: 'SAR' | 'USD';
  prices: Record<string, number>; // bracketId → price
}

export interface HandlingFee {
  type: 'fixed' | 'percent';
  value: number;
}

export interface IntlShippingConfig {
  enabled: boolean;
  brackets: WeightBracket[];
  zones: ZonePricing[];
  blockedCountries: string[]; // ISO-2 codes
  handlingFee: HandlingFee | null;
  overweightMessage: string;
}

export type ShippingCalcResult =
  | { ok: false; reason: 'disabled' | 'blocked' | 'overweight' | 'no_price'; message: string }
  | { ok: true; amount: number; currency: string; zone: ShippingZone; zoneName: string };

// ── Default weight brackets ───────────────────────────────────────────────────

const DEFAULT_BRACKETS: WeightBracket[] = [
  { id: 'b1', minKg: 0,   maxKg: 0.5, labelAr: '0 – 0.5 كجم' },
  { id: 'b2', minKg: 0.5, maxKg: 1,   labelAr: '0.5 – 1 كجم'  },
  { id: 'b3', minKg: 1,   maxKg: 2,   labelAr: '1 – 2 كجم'    },
  { id: 'b4', minKg: 2,   maxKg: 5,   labelAr: '2 – 5 كجم'    },
  { id: 'b5', minKg: 5,   maxKg: 10,  labelAr: '5 – 10 كجم'   },
];

// ── Default zone prices (approximate Egypt Post / Aramex from Egypt) ──────────

const DEFAULT_ZONES: ZonePricing[] = [
  {
    zone: 'saudi',
    nameAr: '🇸🇦 السعودية',
    currency: 'SAR',
    prices: { b1: 30, b2: 45, b3: 70, b4: 120, b5: 200 },
  },
  {
    zone: 'gulf',
    nameAr: '🌙 دول الخليج',
    currency: 'USD',
    prices: { b1: 12, b2: 18, b3: 28, b4: 50, b5: 85 },
  },
  {
    zone: 'arab',
    nameAr: '🌍 الدول العربية',
    currency: 'USD',
    prices: { b1: 9, b2: 14, b3: 22, b4: 38, b5: 65 },
  },
  {
    zone: 'europe',
    nameAr: '🇪🇺 أوروبا وتركيا',
    currency: 'USD',
    prices: { b1: 15, b2: 22, b3: 35, b4: 65, b5: 110 },
  },
  {
    zone: 'americas',
    nameAr: '🌎 أمريكا وكندا وأستراليا',
    currency: 'USD',
    prices: { b1: 20, b2: 30, b3: 50, b4: 90, b5: 150 },
  },
  {
    zone: 'asia',
    nameAr: '🌏 آسيا',
    currency: 'USD',
    prices: { b1: 14, b2: 20, b3: 32, b4: 58, b5: 95 },
  },
  {
    zone: 'africa',
    nameAr: '🌍 أفريقيا',
    currency: 'USD',
    prices: { b1: 12, b2: 18, b3: 30, b4: 55, b5: 90 },
  },
  {
    zone: 'rest',
    nameAr: '🌐 باقي العالم',
    currency: 'USD',
    prices: { b1: 15, b2: 22, b3: 35, b4: 65, b5: 110 },
  },
];

// ── Default blocked countries (war zones / sanctions / no service) ────────────

export const DEFAULT_BLOCKED: string[] = [
  'SY', // سوريا — نزاع مسلح
  'YE', // اليمن — نزاع مسلح
  'LY', // ليبيا — نزاع مسلح
  'SD', // السودان — نزاع مسلح
  'SS', // جنوب السودان — نزاع
  'SO', // الصومال — لا توجد خدمة بريدية
  'AF', // أفغانستان — نزاع / سيطرة طالبان
  'KP', // كوريا الشمالية — مغلقة
];

// ── Countries list ─────────────────────────────────────────────────────────────

export const COUNTRIES: Country[] = [
  // ─ Saudi Arabia ─
  { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia',          zone: 'saudi' },
  // ─ Gulf ─
  { code: 'AE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates',  zone: 'gulf'  },
  { code: 'KW', nameAr: 'الكويت',                    nameEn: 'Kuwait',                zone: 'gulf'  },
  { code: 'QA', nameAr: 'قطر',                        nameEn: 'Qatar',                 zone: 'gulf'  },
  { code: 'BH', nameAr: 'البحرين',                    nameEn: 'Bahrain',               zone: 'gulf'  },
  { code: 'OM', nameAr: 'عُمان',                      nameEn: 'Oman',                  zone: 'gulf'  },
  // ─ Arab World ─
  { code: 'JO', nameAr: 'الأردن',                     nameEn: 'Jordan',                zone: 'arab'  },
  { code: 'LB', nameAr: 'لبنان',                      nameEn: 'Lebanon',               zone: 'arab'  },
  { code: 'PS', nameAr: 'فلسطين',                     nameEn: 'Palestine',             zone: 'arab'  },
  { code: 'IQ', nameAr: 'العراق',                     nameEn: 'Iraq',                  zone: 'arab'  },
  { code: 'MA', nameAr: 'المغرب',                     nameEn: 'Morocco',               zone: 'arab'  },
  { code: 'TN', nameAr: 'تونس',                       nameEn: 'Tunisia',               zone: 'arab'  },
  { code: 'DZ', nameAr: 'الجزائر',                    nameEn: 'Algeria',               zone: 'arab'  },
  { code: 'MR', nameAr: 'موريتانيا',                  nameEn: 'Mauritania',            zone: 'arab'  },
  { code: 'DJ', nameAr: 'جيبوتي',                     nameEn: 'Djibouti',              zone: 'arab'  },
  { code: 'KM', nameAr: 'جزر القمر',                  nameEn: 'Comoros',               zone: 'arab'  },
  // blocked arab
  { code: 'SY', nameAr: 'سوريا',                      nameEn: 'Syria',                 zone: 'arab',  blockedByDefault: true },
  { code: 'YE', nameAr: 'اليمن',                      nameEn: 'Yemen',                 zone: 'arab',  blockedByDefault: true },
  { code: 'LY', nameAr: 'ليبيا',                      nameEn: 'Libya',                 zone: 'arab',  blockedByDefault: true },
  { code: 'SD', nameAr: 'السودان',                    nameEn: 'Sudan',                 zone: 'arab',  blockedByDefault: true },
  // ─ Europe ─
  { code: 'GB', nameAr: 'المملكة المتحدة',             nameEn: 'United Kingdom',        zone: 'europe' },
  { code: 'DE', nameAr: 'ألمانيا',                    nameEn: 'Germany',               zone: 'europe' },
  { code: 'FR', nameAr: 'فرنسا',                      nameEn: 'France',                zone: 'europe' },
  { code: 'IT', nameAr: 'إيطاليا',                    nameEn: 'Italy',                 zone: 'europe' },
  { code: 'ES', nameAr: 'إسبانيا',                    nameEn: 'Spain',                 zone: 'europe' },
  { code: 'NL', nameAr: 'هولندا',                     nameEn: 'Netherlands',           zone: 'europe' },
  { code: 'BE', nameAr: 'بلجيكا',                     nameEn: 'Belgium',               zone: 'europe' },
  { code: 'CH', nameAr: 'سويسرا',                     nameEn: 'Switzerland',           zone: 'europe' },
  { code: 'AT', nameAr: 'النمسا',                     nameEn: 'Austria',               zone: 'europe' },
  { code: 'TR', nameAr: 'تركيا',                      nameEn: 'Turkey',                zone: 'europe' },
  { code: 'SE', nameAr: 'السويد',                     nameEn: 'Sweden',                zone: 'europe' },
  { code: 'NO', nameAr: 'النرويج',                    nameEn: 'Norway',                zone: 'europe' },
  { code: 'DK', nameAr: 'الدنمارك',                   nameEn: 'Denmark',               zone: 'europe' },
  { code: 'FI', nameAr: 'فنلندا',                     nameEn: 'Finland',               zone: 'europe' },
  { code: 'PL', nameAr: 'بولندا',                     nameEn: 'Poland',                zone: 'europe' },
  { code: 'PT', nameAr: 'البرتغال',                   nameEn: 'Portugal',              zone: 'europe' },
  { code: 'GR', nameAr: 'اليونان',                    nameEn: 'Greece',                zone: 'europe' },
  { code: 'IE', nameAr: 'أيرلندا',                    nameEn: 'Ireland',               zone: 'europe' },
  { code: 'CZ', nameAr: 'التشيك',                     nameEn: 'Czech Republic',        zone: 'europe' },
  { code: 'HU', nameAr: 'المجر',                      nameEn: 'Hungary',               zone: 'europe' },
  { code: 'RO', nameAr: 'رومانيا',                    nameEn: 'Romania',               zone: 'europe' },
  { code: 'BG', nameAr: 'بلغاريا',                    nameEn: 'Bulgaria',              zone: 'europe' },
  { code: 'HR', nameAr: 'كرواتيا',                    nameEn: 'Croatia',               zone: 'europe' },
  { code: 'SK', nameAr: 'سلوفاكيا',                   nameEn: 'Slovakia',              zone: 'europe' },
  { code: 'SI', nameAr: 'سلوفينيا',                   nameEn: 'Slovenia',              zone: 'europe' },
  { code: 'LT', nameAr: 'ليتوانيا',                   nameEn: 'Lithuania',             zone: 'europe' },
  { code: 'LV', nameAr: 'لاتفيا',                     nameEn: 'Latvia',                zone: 'europe' },
  { code: 'EE', nameAr: 'إستونيا',                    nameEn: 'Estonia',               zone: 'europe' },
  { code: 'LU', nameAr: 'لوكسمبورغ',                  nameEn: 'Luxembourg',            zone: 'europe' },
  { code: 'MT', nameAr: 'مالطا',                      nameEn: 'Malta',                 zone: 'europe' },
  { code: 'CY', nameAr: 'قبرص',                       nameEn: 'Cyprus',                zone: 'europe' },
  { code: 'IS', nameAr: 'أيسلندا',                    nameEn: 'Iceland',               zone: 'europe' },
  { code: 'AL', nameAr: 'ألبانيا',                    nameEn: 'Albania',               zone: 'europe' },
  { code: 'RS', nameAr: 'صربيا',                      nameEn: 'Serbia',                zone: 'europe' },
  { code: 'ME', nameAr: 'الجبل الأسود',               nameEn: 'Montenegro',            zone: 'europe' },
  { code: 'MK', nameAr: 'مقدونيا الشمالية',           nameEn: 'North Macedonia',       zone: 'europe' },
  { code: 'BA', nameAr: 'البوسنة والهرسك',             nameEn: 'Bosnia & Herzegovina',  zone: 'europe' },
  { code: 'MD', nameAr: 'مولدوفا',                    nameEn: 'Moldova',               zone: 'europe' },
  { code: 'GE', nameAr: 'جورجيا',                     nameEn: 'Georgia',               zone: 'europe' },
  { code: 'AM', nameAr: 'أرمينيا',                    nameEn: 'Armenia',               zone: 'europe' },
  { code: 'AZ', nameAr: 'أذربيجان',                   nameEn: 'Azerbaijan',            zone: 'europe' },
  { code: 'UA', nameAr: 'أوكرانيا',                   nameEn: 'Ukraine',               zone: 'europe' },
  { code: 'IL', nameAr: 'إسرائيل',                    nameEn: 'Israel',                zone: 'europe' },
  // ─ Americas + Oceania ─
  { code: 'US', nameAr: 'الولايات المتحدة',            nameEn: 'United States',         zone: 'americas' },
  { code: 'CA', nameAr: 'كندا',                        nameEn: 'Canada',                zone: 'americas' },
  { code: 'AU', nameAr: 'أستراليا',                    nameEn: 'Australia',             zone: 'americas' },
  { code: 'NZ', nameAr: 'نيوزيلندا',                  nameEn: 'New Zealand',           zone: 'americas' },
  { code: 'MX', nameAr: 'المكسيك',                    nameEn: 'Mexico',                zone: 'americas' },
  { code: 'BR', nameAr: 'البرازيل',                   nameEn: 'Brazil',                zone: 'americas' },
  { code: 'AR', nameAr: 'الأرجنتين',                  nameEn: 'Argentina',             zone: 'americas' },
  { code: 'CL', nameAr: 'تشيلي',                      nameEn: 'Chile',                 zone: 'americas' },
  { code: 'CO', nameAr: 'كولومبيا',                   nameEn: 'Colombia',              zone: 'americas' },
  { code: 'PE', nameAr: 'بيرو',                       nameEn: 'Peru',                  zone: 'americas' },
  { code: 'EC', nameAr: 'الإكوادور',                  nameEn: 'Ecuador',               zone: 'americas' },
  { code: 'UY', nameAr: 'أوروغواي',                   nameEn: 'Uruguay',               zone: 'americas' },
  { code: 'BO', nameAr: 'بوليفيا',                    nameEn: 'Bolivia',               zone: 'americas' },
  { code: 'PY', nameAr: 'باراغواي',                   nameEn: 'Paraguay',              zone: 'americas' },
  { code: 'GT', nameAr: 'غواتيمالا',                  nameEn: 'Guatemala',             zone: 'americas' },
  { code: 'CR', nameAr: 'كوستاريكا',                  nameEn: 'Costa Rica',            zone: 'americas' },
  { code: 'PA', nameAr: 'بنما',                       nameEn: 'Panama',                zone: 'americas' },
  { code: 'DO', nameAr: 'جمهورية الدومينيكان',         nameEn: 'Dominican Republic',    zone: 'americas' },
  { code: 'JM', nameAr: 'جامايكا',                    nameEn: 'Jamaica',               zone: 'americas' },
  { code: 'TT', nameAr: 'ترينيداد وتوباغو',            nameEn: 'Trinidad & Tobago',     zone: 'americas' },
  // ─ Asia ─
  { code: 'IN', nameAr: 'الهند',                      nameEn: 'India',                 zone: 'asia' },
  { code: 'CN', nameAr: 'الصين',                      nameEn: 'China',                 zone: 'asia' },
  { code: 'JP', nameAr: 'اليابان',                    nameEn: 'Japan',                 zone: 'asia' },
  { code: 'KR', nameAr: 'كوريا الجنوبية',              nameEn: 'South Korea',           zone: 'asia' },
  { code: 'SG', nameAr: 'سنغافورة',                   nameEn: 'Singapore',             zone: 'asia' },
  { code: 'MY', nameAr: 'ماليزيا',                    nameEn: 'Malaysia',              zone: 'asia' },
  { code: 'TH', nameAr: 'تايلاند',                    nameEn: 'Thailand',              zone: 'asia' },
  { code: 'ID', nameAr: 'إندونيسيا',                  nameEn: 'Indonesia',             zone: 'asia' },
  { code: 'PH', nameAr: 'الفلبين',                    nameEn: 'Philippines',           zone: 'asia' },
  { code: 'VN', nameAr: 'فيتنام',                     nameEn: 'Vietnam',               zone: 'asia' },
  { code: 'HK', nameAr: 'هونغ كونغ',                  nameEn: 'Hong Kong',             zone: 'asia' },
  { code: 'TW', nameAr: 'تايوان',                     nameEn: 'Taiwan',                zone: 'asia' },
  { code: 'PK', nameAr: 'باكستان',                    nameEn: 'Pakistan',              zone: 'asia' },
  { code: 'BD', nameAr: 'بنغلاديش',                   nameEn: 'Bangladesh',            zone: 'asia' },
  { code: 'LK', nameAr: 'سريلانكا',                   nameEn: 'Sri Lanka',             zone: 'asia' },
  { code: 'NP', nameAr: 'نيبال',                      nameEn: 'Nepal',                 zone: 'asia' },
  { code: 'MV', nameAr: 'المالديف',                   nameEn: 'Maldives',              zone: 'asia' },
  { code: 'KH', nameAr: 'كمبوديا',                    nameEn: 'Cambodia',              zone: 'asia' },
  { code: 'MN', nameAr: 'منغوليا',                    nameEn: 'Mongolia',              zone: 'asia' },
  { code: 'KZ', nameAr: 'كازاخستان',                  nameEn: 'Kazakhstan',            zone: 'asia' },
  { code: 'UZ', nameAr: 'أوزبكستان',                  nameEn: 'Uzbekistan',            zone: 'asia' },
  { code: 'AZ', nameAr: 'أذربيجان',                   nameEn: 'Azerbaijan',            zone: 'asia' },
  // blocked asia
  { code: 'AF', nameAr: 'أفغانستان',                  nameEn: 'Afghanistan',           zone: 'asia', blockedByDefault: true },
  { code: 'KP', nameAr: 'كوريا الشمالية',              nameEn: 'North Korea',           zone: 'asia', blockedByDefault: true },
  // ─ Africa ─
  { code: 'NG', nameAr: 'نيجيريا',                    nameEn: 'Nigeria',               zone: 'africa' },
  { code: 'GH', nameAr: 'غانا',                       nameEn: 'Ghana',                 zone: 'africa' },
  { code: 'KE', nameAr: 'كينيا',                      nameEn: 'Kenya',                 zone: 'africa' },
  { code: 'ET', nameAr: 'إثيوبيا',                    nameEn: 'Ethiopia',              zone: 'africa' },
  { code: 'TZ', nameAr: 'تنزانيا',                    nameEn: 'Tanzania',              zone: 'africa' },
  { code: 'UG', nameAr: 'أوغندا',                     nameEn: 'Uganda',                zone: 'africa' },
  { code: 'ZA', nameAr: 'جنوب أفريقيا',               nameEn: 'South Africa',          zone: 'africa' },
  { code: 'SN', nameAr: 'السنغال',                    nameEn: 'Senegal',               zone: 'africa' },
  { code: 'CI', nameAr: 'ساحل العاج',                  nameEn: "Côte d'Ivoire",         zone: 'africa' },
  { code: 'CM', nameAr: 'الكاميرون',                  nameEn: 'Cameroon',              zone: 'africa' },
  { code: 'RW', nameAr: 'رواندا',                     nameEn: 'Rwanda',                zone: 'africa' },
  { code: 'ZM', nameAr: 'زامبيا',                     nameEn: 'Zambia',                zone: 'africa' },
  { code: 'ZW', nameAr: 'زيمبابوي',                   nameEn: 'Zimbabwe',              zone: 'africa' },
  { code: 'MZ', nameAr: 'موزمبيق',                    nameEn: 'Mozambique',            zone: 'africa' },
  { code: 'AO', nameAr: 'أنغولا',                     nameEn: 'Angola',                zone: 'africa' },
  { code: 'MG', nameAr: 'مدغشقر',                     nameEn: 'Madagascar',            zone: 'africa' },
  { code: 'MU', nameAr: 'موريشيوس',                   nameEn: 'Mauritius',             zone: 'africa' },
  { code: 'GA', nameAr: 'الغابون',                    nameEn: 'Gabon',                 zone: 'africa' },
  { code: 'CD', nameAr: 'الكونغو الديمقراطية',         nameEn: 'DR Congo',              zone: 'africa' },
  { code: 'CG', nameAr: 'الكونغو',                    nameEn: 'Republic of Congo',     zone: 'africa' },
  { code: 'SL', nameAr: 'سيراليون',                   nameEn: 'Sierra Leone',          zone: 'africa' },
  { code: 'GN', nameAr: 'غينيا',                      nameEn: 'Guinea',                zone: 'africa' },
  { code: 'BF', nameAr: 'بوركينا فاسو',               nameEn: 'Burkina Faso',          zone: 'africa' },
  { code: 'ML', nameAr: 'مالي',                       nameEn: 'Mali',                  zone: 'africa' },
  { code: 'NE', nameAr: 'النيجر',                     nameEn: 'Niger',                 zone: 'africa' },
  { code: 'TG', nameAr: 'توغو',                       nameEn: 'Togo',                  zone: 'africa' },
  { code: 'BJ', nameAr: 'بنين',                       nameEn: 'Benin',                 zone: 'africa' },
  { code: 'NA', nameAr: 'ناميبيا',                    nameEn: 'Namibia',               zone: 'africa' },
  { code: 'BW', nameAr: 'بوتسوانا',                   nameEn: 'Botswana',              zone: 'africa' },
  { code: 'MW', nameAr: 'ملاوي',                      nameEn: 'Malawi',                zone: 'africa' },
  { code: 'ER', nameAr: 'إريتريا',                    nameEn: 'Eritrea',               zone: 'africa' },
  // blocked africa
  { code: 'SS', nameAr: 'جنوب السودان',               nameEn: 'South Sudan',           zone: 'africa', blockedByDefault: true },
  { code: 'SO', nameAr: 'الصومال',                    nameEn: 'Somalia',               zone: 'africa', blockedByDefault: true },
];

// Lookup helpers
export function getCountry(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code.toUpperCase());
}

export function getZoneForCountry(code: string): ShippingZone {
  if (code.toUpperCase() === 'EG') return 'rest'; // Egypt uses local shipping
  return getCountry(code)?.zone ?? 'rest';
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ml-intl-v2';

export const DEFAULT_CONFIG: IntlShippingConfig = {
  enabled: true,
  brackets: DEFAULT_BRACKETS,
  zones: DEFAULT_ZONES,
  blockedCountries: DEFAULT_BLOCKED,
  handlingFee: null,
  overweightMessage: 'سيتم تحديد تكلفة الشحن بعد مراجعة الطلب',
};

export function getIntlShippingConfig(): IntlShippingConfig {
  if (typeof window === 'undefined') return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const saved = JSON.parse(raw) as Partial<IntlShippingConfig>;
    // Merge to pick up any new defaults added in code updates
    return {
      enabled:          saved.enabled          ?? DEFAULT_CONFIG.enabled,
      brackets:         saved.brackets?.length  ? saved.brackets  : DEFAULT_CONFIG.brackets,
      zones:            saved.zones?.length      ? saved.zones     : DEFAULT_CONFIG.zones,
      blockedCountries: saved.blockedCountries   ?? DEFAULT_CONFIG.blockedCountries,
      handlingFee:      saved.handlingFee        ?? DEFAULT_CONFIG.handlingFee,
      overweightMessage: saved.overweightMessage || DEFAULT_CONFIG.overweightMessage,
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveIntlShippingConfig(config: IntlShippingConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  // Notify other tabs / components
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
}

// ── Price Calculation ─────────────────────────────────────────────────────────

export function calculateIntlShipping(
  weightKg: number,
  countryCode: string,
  config?: IntlShippingConfig,
): ShippingCalcResult {
  const cfg = config ?? getIntlShippingConfig();
  const code = countryCode.toUpperCase();

  if (!cfg.enabled) {
    return { ok: false, reason: 'disabled', message: 'الشحن الدولي غير متاح حاليًا' };
  }
  if (code === 'EG') {
    return { ok: false, reason: 'disabled', message: 'استخدم الشحن المحلي لمصر' };
  }
  if (cfg.blockedCountries.includes(code)) {
    return { ok: false, reason: 'blocked', message: 'الشحن غير متاح لهذه الدولة حاليًا' };
  }

  const zone = code === 'SA' ? 'saudi' : (getCountry(code)?.zone ?? 'rest');
  const zoneConfig = cfg.zones.find(z => z.zone === zone) ?? cfg.zones.find(z => z.zone === 'rest');

  if (!zoneConfig) {
    return { ok: false, reason: 'no_price', message: 'الشحن الدولي غير متاح حاليًا' };
  }

  const sorted = [...cfg.brackets].sort((a, b) => a.minKg - b.minKg);
  const maxBracket = sorted[sorted.length - 1];

  if (sorted.length === 0 || weightKg > maxBracket.maxKg) {
    return { ok: false, reason: 'overweight', message: cfg.overweightMessage };
  }

  const bracket = sorted.find(b => weightKg >= b.minKg && weightKg <= b.maxKg) ?? sorted[0];
  const basePrice = zoneConfig.prices[bracket.id];

  if (!basePrice || basePrice <= 0) {
    return { ok: false, reason: 'no_price', message: 'الشحن الدولي غير متاح حاليًا' };
  }

  let amount = basePrice;
  if (cfg.handlingFee && cfg.handlingFee.value > 0) {
    if (cfg.handlingFee.type === 'percent') {
      amount = Math.ceil(amount * (1 + cfg.handlingFee.value / 100));
    } else {
      amount = Math.ceil(amount + cfg.handlingFee.value);
    }
  }

  return {
    ok: true,
    amount,
    currency: zoneConfig.currency,
    zone,
    zoneName: zoneConfig.nameAr,
  };
}
