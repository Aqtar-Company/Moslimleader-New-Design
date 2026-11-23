import { COUNTRY_CURRENCIES } from '@/lib/geo-pricing';

/**
 * Live USD → local exchange rates, refreshed once a day.
 *
 * Prices for visitors outside Egypt are set in USD and SHOWN in their own currency using
 * COUNTRY_CURRENCIES[cc].usdRate. Those rates were typed into the code once (1 USD = 36 TRY)
 * and never moved, so a Turkish visitor saw a lira price far from the real one.
 *
 * Now the server fetches the day's rates (open.er-api.com — free, no key) and writes them
 * INTO COUNTRY_CURRENCIES, which every converter already reads: the display, the PayPal
 * routes' toUsd(), the assistant's price block. The browser gets the same numbers from
 * /api/fx-rates, so what is shown and what PayPal computes come from one table.
 *
 * Safety: a fetched rate is used only if it is a positive number within 0.2×–5× of the
 * built-in one (a bad feed must not turn a price into nonsense); otherwise, and whenever the
 * feed is down, the built-in table stays. Nothing here can break a page.
 *
 * Egypt is not affected: EGP prices are set directly, and EGP→USD stays the shop's own
 * fixed rate (src/lib/currency.ts) — that one is a pricing decision, not a market quote.
 */

const SOURCE = 'https://open.er-api.com/v6/latest/USD';
const TTL_MS = 12 * 60 * 60 * 1000;
const BUILT_IN: Record<string, number> = Object.fromEntries(
  Object.values(COUNTRY_CURRENCIES).map(c => [c.currencyEn, c.usdRate]),
);

let fetchedAt = 0;
let inflight: Promise<void> | null = null;
let current: Record<string, number> = { ...BUILT_IN };

/** Write a set of rates into the shared table (server or browser). */
export function applyRates(rates: Record<string, number>) {
  for (const c of Object.values(COUNTRY_CURRENCIES)) {
    const r = rates[c.currencyEn];
    const base = BUILT_IN[c.currencyEn];
    if (typeof r === 'number' && Number.isFinite(r) && r > 0 && base && r >= base * 0.2 && r <= base * 5) {
      c.usdRate = r;
    }
  }
}

/** Make sure today's rates are loaded. Cheap after the first call; never throws. */
export async function ensureFreshRates(): Promise<void> {
  if (Date.now() - fetchedAt < TTL_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(SOURCE, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.result === 'success' && d.rates && typeof d.rates === 'object') {
        const picked: Record<string, number> = {};
        for (const code of Object.keys(BUILT_IN)) {
          const r = Number(d.rates[code]);
          if (Number.isFinite(r) && r > 0) picked[code] = r;
        }
        applyRates(picked);
        current = Object.fromEntries(Object.values(COUNTRY_CURRENCIES).map(c => [c.currencyEn, c.usdRate]));
        fetchedAt = Date.now();
        return;
      }
      throw new Error(`fx feed answered ${res.status}`);
    } catch (err) {
      console.error('[fx-rates]', (err as Error).message);
      // Try again in an hour rather than on every request.
      fetchedAt = Date.now() - TTL_MS + 60 * 60 * 1000;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The rates in use right now, and when they were fetched (0 = built-in table). */
export function currentRates() {
  return { rates: { ...current }, fetchedAt };
}
