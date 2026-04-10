// The email address that has admin access to the dashboard
// Read from environment variable — never hardcoded
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase();

// Default coupons (used as fallback if no coupons in DB)
export const DEFAULT_COUPONS: Record<string, number> = {
  'MOSLIM10': 10,
  'RAMADAN20': 20,
  'WELCOME15': 15,
  'SAVE25': 25,
};
