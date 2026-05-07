// Single source of truth for the EGP→USD conversion rate.
// All PayPal flows (shop checkout, book purchase, series purchase) must
// use the same rate so the customer-facing price never drifts between
// product cards and the PayPal modal. If you need to tweak the rate,
// change it here and grep for any inline copies that snuck in.
//
// 1 EGP ≈ 0.02 USD (1 USD = 50 EGP). The rate is approximate — PayPal
// will FX-convert at its own rate at capture time, but we charge the
// customer the USD amount we computed here, so this is what they see.
import { COUNTRY_CURRENCIES } from './geo-pricing';

export const EGP_TO_USD = 1 / 50;

// Convert a positive EGP amount to USD, rounded to 2 decimals.
// Floors at $0.01 — PayPal rejects amounts below 1 cent.
export function egpToUsd(egp: number): number {
  if (!Number.isFinite(egp) || egp <= 0) return 0.01;
  return Math.max(0.01, Math.round(egp * EGP_TO_USD * 100) / 100);
}

/**
 * Convert a local-currency amount to USD using the same logic the PayPal
 * routes share:
 * - 'USD' → identity
 * - 'EGP' → EGP_TO_USD rate
 * - other → divide by the country's `usdRate` from COUNTRY_CURRENCIES
 * - unknown → treat as USD (safe fallback)
 */
export function toUsd(amount: number, currencyEn: string): number {
  if (!amount || amount <= 0) return 0;
  if (currencyEn === 'USD') return amount;
  if (currencyEn === 'EGP') return amount * EGP_TO_USD;
  const entry = Object.values(COUNTRY_CURRENCIES).find(c => c.currencyEn === currencyEn);
  if (entry && entry.usdRate > 0) {
    return amount / entry.usdRate;
  }
  return amount;
}
