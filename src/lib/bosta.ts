// Bosta shipping API client.
// Docs: https://developer.bosta.co — uses raw token in Authorization header.

function getBaseUrl(): string {
  const raw = (process.env.BOSTA_API_URL || '').trim();
  if (raw) return raw.replace(/\/+$/, '');
  // Use staging when token clearly looks like a staging key, otherwise production.
  const tok = (process.env.BOSTA_API_TOKEN || '').trim();
  if (/staging|sandbox|stg/i.test(tok)) return 'https://stg-app.bosta.co/api/v2';
  return 'https://app.bosta.co/api/v2';
}

function getToken(): string {
  return (process.env.BOSTA_API_TOKEN || '').trim();
}

export interface BostaReceiver {
  firstName: string;
  lastName: string;
  phone: string;
  secondPhone?: string;
  email?: string;
}

export interface BostaAddress {
  cityId?: string;         // Bosta city _id (preferred)
  city?: string;           // Bosta city name (fallback)
  zone?: string;
  zoneId?: string;
  district?: string;
  districtId?: string;
  firstLine: string;       // street / address line 1
  secondLine?: string;
  buildingNumber?: string;
  floor?: string;
  apartment?: string;
}

export interface CreateDeliveryInput {
  type: number;                // 10 = Send (delivery)
  specs: { packageType: string; size?: string; packageDetails?: { itemsCount?: number; description?: string } };
  notes?: string;
  cod?: number;                // cash-on-delivery amount (EGP)
  receiver: BostaReceiver;
  dropOffAddress: BostaAddress;
  businessReference?: string;  // your order id
}

export interface BostaDelivery {
  _id: string;
  trackingNumber: string;
  state?: { value?: string; code?: number };
  masterAWB?: string;
}

interface BostaResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

async function bostaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new Error('BOSTA_API_TOKEN is not configured');
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: BostaResponse<T> | T | undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  if (!res.ok) {
    const wrapped = body as BostaResponse<T> & { errors?: Array<{ message?: string }> };
    const detailed =
      wrapped?.message ||
      wrapped?.errors?.map(e => e?.message).filter(Boolean).join('; ') ||
      text?.slice(0, 200) ||
      `Bosta API error ${res.status}`;
    console.error('[bosta]', { url, status: res.status, body: text?.slice(0, 500) });
    throw new Error(`Bosta ${res.status}: ${detailed}`);
  }
  const wrapped = body as BostaResponse<T>;
  return (wrapped?.data ?? body) as T;
}

// Lightweight diagnostic — fetches the cities list, which requires a valid token.
export async function pingBosta(): Promise<{ ok: true; baseUrl: string; tokenPrefix: string }> {
  const token = getToken();
  if (!token) throw new Error('BOSTA_API_TOKEN is not configured');
  const baseUrl = getBaseUrl();
  await bostaFetch('/cities');
  return { ok: true, baseUrl, tokenPrefix: token.slice(0, 6) + '…' };
}

export async function createDelivery(input: CreateDeliveryInput): Promise<BostaDelivery> {
  return bostaFetch<BostaDelivery>('/deliveries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getDelivery(deliveryId: string): Promise<BostaDelivery> {
  return bostaFetch<BostaDelivery>(`/deliveries/${deliveryId}`);
}

// Track by AWB / tracking number — this is the public-business endpoint that
// reliably returns the latest state. Use this for status refresh.
export async function trackByNumber(trackingNumber: string): Promise<{
  state?: { value?: string; code?: number };
  TrackingNumber?: string;
  trackingNumber?: string;
  CurrentStatus?: { state?: string; code?: number; timestamp?: string };
  TransitEvents?: Array<{ state?: string; timestamp?: string; hub?: string }>;
}> {
  return bostaFetch(`/deliveries/business/track/${trackingNumber}`);
}

export async function trackDelivery(trackingNumber: string): Promise<unknown> {
  return bostaFetch<unknown>(`/deliveries/business/track/${trackingNumber}`);
}

// Terminate (cancel) a delivery on Bosta. Only succeeds if the package
// hasn't been picked up yet. Bosta v2 doesn't document a single canonical
// path for this — different tenants land on different routes — so we try
// the known shapes in order until one accepts the request.
export async function cancelDelivery(deliveryId: string): Promise<void> {
  const attempts: Array<{ method: string; path: string }> = [
    { method: 'DELETE', path: `/deliveries/business/${deliveryId}` },
    { method: 'PUT',    path: `/deliveries/${deliveryId}/terminate` },
    { method: 'PATCH',  path: `/deliveries/${deliveryId}/terminate` },
    { method: 'DELETE', path: `/deliveries/${deliveryId}` },
  ];
  let lastError: unknown = null;
  for (const { method, path } of attempts) {
    try {
      await bostaFetch<unknown>(path, { method });
      return;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      // 404 / Cannot METHOD = wrong route; keep trying. Anything else (auth,
      // business rule like "already picked up") is a real error — surface it.
      if (!/404|Cannot (DELETE|PUT|PATCH|GET|POST)/i.test(msg)) {
        throw err;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Bosta: لم نعثر على endpoint إلغاء صالح');
}

// In-memory cache for the cities list (24h TTL).
interface BostaCity { _id: string; name: string; nameAr?: string }
let citiesCache: { at: number; list: BostaCity[] } | null = null;
const CITIES_TTL_MS = 24 * 60 * 60 * 1000;

export async function getBostaCities(): Promise<BostaCity[]> {
  if (citiesCache && Date.now() - citiesCache.at < CITIES_TTL_MS) return citiesCache.list;
  const list = await bostaFetch<BostaCity[]>('/cities');
  citiesCache = { at: Date.now(), list: Array.isArray(list) ? list : [] };
  return citiesCache.list;
}

export async function bostaCityIdFromGovernorate(governorateId?: string | null): Promise<string | null> {
  if (!governorateId) return null;
  const target = (GOVERNORATE_TO_BOSTA[governorateId] || governorateId).toLowerCase();
  try {
    const cities = await getBostaCities();
    const match = cities.find(c =>
      c.name?.toLowerCase() === target ||
      c.nameAr?.toLowerCase() === target ||
      c.name?.toLowerCase().includes(target),
    );
    return match?._id || null;
  } catch (err) {
    console.error('[bosta cities lookup]', err);
    return null;
  }
}

// Normalize an Egyptian phone number to the 11-digit `01xxxxxxxxx` shape Bosta expects.
// Returns null if the input can't be coerced into a valid Egyptian mobile.
export function normalizeEgyptPhone(input?: string | null): string | null {
  if (!input) return null;
  let digits = input.replace(/\D+/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits;
  if (digits.length === 11 && /^01[0-2,5]\d{8}$/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith('01')) return digits;
  return null;
}

// Build the public tracking URL. Configurable via BOSTA_TRACKING_URL with `{tn}` placeholder.
export function bostaTrackingUrl(trackingNumber: string): string {
  const tpl = (process.env.BOSTA_TRACKING_URL || '').trim() || 'https://bosta.co/en/track-shipment/{tn}';
  return tpl.replace('{tn}', encodeURIComponent(trackingNumber));
}

// Map our Egyptian governorate ids to Bosta city names (English).
const GOVERNORATE_TO_BOSTA: Record<string, string> = {
  cairo: 'Cairo',
  giza: 'Giza',
  qalyubia: 'Qalyubia',
  alexandria: 'Alexandria',
  sharqia: 'Sharqia',
  dakahlia: 'Dakahlia',
  gharbia: 'Gharbia',
  monufia: 'Monufia',
  suez: 'Suez',
  ismailia: 'Ismailia',
  'port-said': 'Port Said',
  beheira: 'Beheira',
  damietta: 'Damietta',
  'kafr-sheikh': 'Kafr El Sheikh',
  fayoum: 'Fayoum',
  'beni-suef': 'Beni Suef',
  minya: 'Minya',
  asyut: 'Asyut',
  sohag: 'Sohag',
  qena: 'Qena',
  luxor: 'Luxor',
  aswan: 'Aswan',
  'red-sea': 'Red Sea',
  'north-sinai': 'North Sinai',
  'south-sinai': 'South Sinai',
  matruh: 'Matrouh',
  'new-valley': 'New Valley',
};

export function bostaCityFromGovernorate(governorateId?: string | null): string {
  if (!governorateId) return 'Cairo';
  return GOVERNORATE_TO_BOSTA[governorateId] || governorateId;
}

// Verify webhook signature. Bosta sends signature in `x-bosta-signature` header
// (HMAC-SHA256 of the raw body using BOSTA_WEBHOOK_SECRET) on configured webhooks.
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.BOSTA_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const { createHmac, timingSafeEqual } = await import('crypto');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  // Allow either hex digest or hex with prefix
  const provided = signature.replace(/^sha256=/, '').trim();
  let b: Buffer;
  try { b = Buffer.from(provided, 'hex'); } catch { return false; }
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
