// Bosta shipping API client.
// Docs: https://developer.bosta.co — uses raw token in Authorization header.

const BASE_URL = process.env.BOSTA_API_URL || 'https://app.bosta.co/api/v2';
const TOKEN = process.env.BOSTA_API_TOKEN || '';

export interface BostaAddress {
  firstName: string;
  lastName: string;
  phone: string;
  secondPhone?: string;
  email?: string;
  city: string;        // Bosta city name (English)
  zone?: string;
  district?: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
}

export interface CreateDeliveryInput {
  type: number;                // 10 = Send (delivery)
  specs: { packageType: string; size?: string; packageDetails?: { itemsCount?: number; description?: string } };
  notes?: string;
  cod?: number;                // cash-on-delivery amount (EGP)
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
  if (!TOKEN) throw new Error('BOSTA_API_TOKEN is not configured');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: TOKEN,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: BostaResponse<T> | T | undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  if (!res.ok) {
    const msg = (body as BostaResponse<T>)?.message || `Bosta API error ${res.status}`;
    throw new Error(msg);
  }
  const wrapped = body as BostaResponse<T>;
  return (wrapped?.data ?? body) as T;
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

export async function trackDelivery(trackingNumber: string): Promise<unknown> {
  return bostaFetch<unknown>(`/deliveries/business/track/${trackingNumber}`);
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
