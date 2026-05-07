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

// Fetch the Bosta AWB (airway bill / بوليصة الشحن). Bosta tenants vary:
// some return a PDF binary, others a JSON envelope with a temporary URL.
// Try the documented paths in order, accept whichever responds 2xx.
export async function getDeliveryAwb(
  deliveryId: string,
): Promise<{ kind: 'pdf'; pdf: Buffer } | { kind: 'url'; url: string }> {
  const token = getToken();
  if (!token) throw new Error('BOSTA_API_TOKEN is not configured');
  const baseUrl = getBaseUrl();
  const candidates = [
    `/deliveries/${deliveryId}/awb`,
    `/deliveries/business/${deliveryId}/awb`,
    `/deliveries/awb/${deliveryId}`,
  ];
  let lastErr: { status: number; body: string } | null = null;
  for (const path of candidates) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: token, Accept: 'application/pdf, application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      lastErr = { status: res.status, body: (await res.text()).slice(0, 300) };
      if (res.status === 404 || res.status === 405) continue;
      // Real error — surface it with the original status.
      throw new Error(`Bosta ${res.status}: ${lastErr.body || 'AWB unavailable'}`);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/pdf')) {
      const ab = await res.arrayBuffer();
      return { kind: 'pdf', pdf: Buffer.from(ab) };
    }
    // JSON envelope — look for a URL field.
    const json = await res.json().catch(() => null) as
      | { data?: { url?: string; awb?: string; pdf?: string } | string; url?: string; awb?: string }
      | null;
    const dataObj = typeof json?.data === 'object' ? json?.data : undefined;
    const url =
      (typeof json?.data === 'string' ? json.data : undefined) ||
      dataObj?.url ||
      dataObj?.awb ||
      json?.url ||
      json?.awb;
    if (typeof url === 'string' && url) return { kind: 'url', url };
    // Some tenants base64-encode the PDF in `data.pdf`.
    const b64 = dataObj?.pdf;
    if (typeof b64 === 'string' && b64.length > 100) {
      return { kind: 'pdf', pdf: Buffer.from(b64, 'base64') };
    }
    lastErr = { status: 200, body: 'unrecognised AWB response shape' };
  }
  throw new Error(lastErr ? `Bosta ${lastErr.status}: ${lastErr.body}` : 'Bosta: تعذر جلب البوليصة');
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

// List deliveries page-by-page. Bosta's business listing is `POST
// /deliveries/search` with a JSON body in v2 — but tenants vary, so we try
// the common variants and normalise the response.
export async function listDeliveries(page: number, limit = 50): Promise<{
  items: BostaListDelivery[];
  hasMore: boolean;
}> {
  type Attempt = { method: 'GET' | 'POST'; path: string; body?: string };
  const searchBody = JSON.stringify({
    pageNumber: page - 1,
    pageLimit: limit,
    page: page - 1,
    limit,
    sortBy: '-createdAt',
  });
  const candidates: Attempt[] = [
    { method: 'POST', path: `/deliveries/search`,           body: searchBody },
    { method: 'POST', path: `/deliveries/business/search`,  body: searchBody },
    { method: 'GET',  path: `/deliveries?page=${page}&limit=${limit}` },
    { method: 'GET',  path: `/deliveries/business?page=${page}&limit=${limit}` },
    { method: 'GET',  path: `/deliveries/business/list?page=${page}&limit=${limit}` },
  ];
  let lastError: unknown = null;
  for (const c of candidates) {
    try {
      const init: RequestInit = { method: c.method };
      if (c.body) init.body = c.body;
      const res = await bostaFetch<DeliveriesPage | BostaListDelivery[]>(c.path, init);
      const items: BostaListDelivery[] = Array.isArray(res)
        ? res
        : res?.list || res?.deliveries || res?.data || [];
      const total = (res as DeliveriesPage)?.count ?? (res as DeliveriesPage)?.total;
      const hasMore = items.length >= limit
        || (typeof (res as DeliveriesPage)?.hasMore === 'boolean' && !!(res as DeliveriesPage).hasMore)
        || (typeof total === 'number' && page * limit < total);
      return { items, hasMore };
    } catch (err) {
      lastError = err;
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

export interface BostaCancelAttempt { method: string; path: string; status: number | null; message: string }

export class BostaCancelError extends Error {
  attemptLog: BostaCancelAttempt[];
  constructor(message: string, attemptLog: BostaCancelAttempt[]) {
    super(message);
    this.name = 'BostaCancelError';
    this.attemptLog = attemptLog;
  }
}

export async function cancelDelivery(deliveryId: string, trackingNumber?: string | null): Promise<void> {
  const reasonBody = JSON.stringify({ reason: 'admin_cancelled' });
  const terminateBody = JSON.stringify({ deliveryId, reason: 'admin_cancelled' });
  // Documented Bosta v2 terminate is `DELETE /deliveries/{id}` with NO body —
  // sending a body crashes some tenants' handler on `req.body._id`. Order:
  // documented endpoint first, then known fallbacks.
  const attempts: Array<{ method: string; path: string; body?: string }> = [
    { method: 'DELETE', path: `/deliveries/${deliveryId}` },
    { method: 'DELETE', path: `/deliveries/business/${deliveryId}` },
    { method: 'POST',   path: `/deliveries/terminate`,                body: terminateBody },
    { method: 'PUT',    path: `/deliveries/${deliveryId}/terminate`,  body: reasonBody },
    { method: 'PATCH',  path: `/deliveries/${deliveryId}/terminate`,  body: reasonBody },
  ];
  if (trackingNumber) {
    attempts.push(
      { method: 'DELETE', path: `/deliveries/business/track/${trackingNumber}` },
      { method: 'PUT',    path: `/deliveries/business/track/${trackingNumber}/terminate`, body: reasonBody },
    );
  }
  const attemptLog: BostaCancelAttempt[] = [];
  let firstRealError: { status: number; message: string } | null = null;
  for (const a of attempts) {
    try {
      const init: RequestInit = { method: a.method };
      if (a.body) init.body = a.body;
      await bostaFetch<unknown>(a.path, init);
      attemptLog.push({ method: a.method, path: a.path, status: 200, message: 'ok' });
      console.error('[bosta cancel chain]', { deliveryId, trackingNumber, attemptLog });
      return;
    } catch (err) {
      const status = parseBostaStatus(err);
      const msg = err instanceof Error ? err.message : String(err);
      attemptLog.push({ method: a.method, path: a.path, status, message: msg });
      // 404/405 = wrong route. 500 with `_id` = documented Bosta handler bug
      // when our body shape doesn't match. Both → keep trying.
      const isSoftMiss =
        status === 404 ||
        status === 405 ||
        (status === 500 && /reading '_id'/.test(msg));
      if (isSoftMiss) continue;
      // The first informative 4xx/5xx — capture it but keep trying so we
      // don't bail on a single tenant-specific quirk.
      if (!firstRealError && status !== null) firstRealError = { status, message: msg };
    }
  }
  console.error('[bosta cancel chain]', { deliveryId, trackingNumber, attemptLog });
  const message = firstRealError?.message
    || 'Bosta: لم نعثر على endpoint إلغاء صالح — راجع لوج السيرفر';
  throw new BostaCancelError(message, attemptLog);
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
