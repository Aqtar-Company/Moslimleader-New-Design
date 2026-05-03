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

export interface BostaListDelivery {
  _id: string;
  trackingNumber: string;
  state?: { value?: string; code?: number };
  cod?: number;
  businessReference?: string;
  createdAt?: string;
  receiver?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    secondPhone?: string;
    email?: string;
  };
  dropOffAddress?: {
    city?: { name?: string; nameAr?: string };
    cityName?: string;
    zone?: { name?: string; nameAr?: string };
    district?: { name?: string; nameAr?: string };
    firstLine?: string;
    secondLine?: string;
    buildingNumber?: string;
    floor?: string;
    apartment?: string;
  };
  cityName?: string;
  pickupAddress?: unknown;
}

interface DeliveriesPage {
  list?: BostaListDelivery[];
  deliveries?: BostaListDelivery[];
  data?: BostaListDelivery[];
  count?: number;
  total?: number;
  hasMore?: boolean;
}

// List deliveries page-by-page. Bosta tenants vary on the exact path & shape
// so we try the common variants and normalise the response.
export async function listDeliveries(page: number, limit = 50): Promise<{
  items: BostaListDelivery[];
  hasMore: boolean;
}> {
  const candidates = [
    `/deliveries?page=${page}&limit=${limit}`,
    `/deliveries/business?page=${page}&limit=${limit}`,
    `/deliveries/search?page=${page}&limit=${limit}`,
  ];
  let lastError: unknown = null;
  for (const path of candidates) {
    try {
      const res = await bostaFetch<DeliveriesPage | BostaListDelivery[]>(path);
      const items: BostaListDelivery[] = Array.isArray(res)
        ? res
        : res?.list || res?.deliveries || res?.data || [];
      const hasMore = items.length === limit
        || (typeof (res as DeliveriesPage)?.hasMore === 'boolean' && !!(res as DeliveriesPage).hasMore)
        || (typeof (res as DeliveriesPage)?.total === 'number' && page * limit < ((res as DeliveriesPage).total ?? 0));
      return { items, hasMore };
    } catch (err) {
      lastError = err;
      // If 404/405 → next path, anything else → real error
      const msg = err instanceof Error ? err.message : '';
      const m = msg.match(/^Bosta (\d{3}):/);
      const status = m ? parseInt(m[1], 10) : null;
      if (status !== 404 && status !== 405) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Bosta: لم نعثر على endpoint listing صالح');
}

// Terminate (cancel) a delivery on Bosta. Only succeeds if the package
// hasn't been picked up yet. Bosta v2 doesn't document a single canonical
// path for this — different tenants land on different routes — so we try
// the known shapes in order until one accepts the request. Some tenants
// also crash with a 500 reading `_id` from req.body, so we always send a
// body for the methods that accept one.
// Parse the HTTP status from a `bostaFetch` error message of the form
// "Bosta 404: ...". Returns null when the format doesn't match (e.g. network
// error before a response).
function parseBostaStatus(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : '';
  const m = msg.match(/^Bosta (\d{3}):/);
  return m ? parseInt(m[1], 10) : null;
}

export async function cancelDelivery(deliveryId: string): Promise<void> {
  const body = JSON.stringify({ deliveryId, _id: deliveryId, reason: 'admin_cancelled' });
  const attempts: Array<{ method: string; path: string; withBody: boolean }> = [
    { method: 'POST',   path: `/deliveries/terminate`,                withBody: true  },
    { method: 'PUT',    path: `/deliveries/${deliveryId}/terminate`,  withBody: true  },
    { method: 'PATCH',  path: `/deliveries/${deliveryId}/terminate`,  withBody: true  },
    { method: 'DELETE', path: `/deliveries/business/${deliveryId}`,   withBody: false },
    { method: 'DELETE', path: `/deliveries/${deliveryId}`,            withBody: true  },
  ];
  let lastError: unknown = null;
  for (const { method, path, withBody } of attempts) {
    try {
      await bostaFetch<unknown>(path, withBody ? { method, body } : { method });
      return;
    } catch (err) {
      lastError = err;
      const status = parseBostaStatus(err);
      // 404 (route absent) and 405 (method not allowed) → keep trying the next
      // shape. Anything else (4xx business rule like "already picked up", 401
      // auth, 5xx server error) is real and must surface to the admin.
      if (status === 404 || status === 405) continue;
      throw err;
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

// Re-exported from the shared phone helper so imports from `@/lib/bosta` keep
// working. New code should import from `@/lib/phone` directly.
export { normalizeEgyptPhone } from './phone';

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
