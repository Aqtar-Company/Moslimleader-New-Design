'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { detectCountry, countryToZone, resolvePrice, PricingZone, PriceResult, ZONES, ZoneInfo, COUNTRY_CURRENCIES } from '@/lib/geo-pricing';
import { getProductOverrides } from '@/lib/admin-storage';
import { Product } from '@/types';
import { CartItem } from '@/types';

const COUNTRY_STORAGE_KEY = 'ml-pricing-country';
const COUNTRY_STORAGE_TIMESTAMP_KEY = 'ml-pricing-country-ts';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — re-detect after this

interface RegionalPricingContextValue {
  zone: PricingZone;
  zoneInfo: ZoneInfo;
  countryCode: string | null;
  originCountryCode: string | null;
  setCountry: (code: string | null) => void;
  setZone: (zone: PricingZone) => void;
  isDetecting: boolean;
  getProductPrice: (product: Product) => PriceResult;
  formatPrice: (result: PriceResult) => string;
  getCartRegionalTotal: (items: CartItem[]) => { total: number; currency: string; currencyEn: string };
}

const RegionalPricingContext = createContext<RegionalPricingContextValue | null>(null);

export function RegionalPricingProvider({ children }: { children: ReactNode }) {
  const [zone, setZoneState] = useState<PricingZone>('egypt');
  const [countryCode, setCountryCodeState] = useState<string | null>(null);
  const [originCountryCode, setOriginCountryCode] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    // Check saved preference — only use cache if it was set manually by user OR is fresh (< 6h)
    try {
      const saved = localStorage.getItem(COUNTRY_STORAGE_KEY);
      const savedTs = localStorage.getItem(COUNTRY_STORAGE_TIMESTAMP_KEY);
      const isManual = !savedTs; // no timestamp = manually set by user, respect it
      const isFresh = savedTs && (Date.now() - parseInt(savedTs, 10)) < CACHE_TTL_MS;
      if (saved && (isManual || isFresh)) {
        setCountryCodeState(saved);
        setZoneState(countryToZone(saved));
        setIsDetecting(false);
        return;
      }
    } catch {}

    // Auto-detect from IP (server-side API first, then client-side fallbacks)
    detectCountry().then(code => {
      if (code) {
        setCountryCodeState(code);
        setZoneState(countryToZone(code));
        setOriginCountryCode(code);
        // Cache with timestamp so it expires after TTL
        try {
          localStorage.setItem(COUNTRY_STORAGE_KEY, code);
          localStorage.setItem(COUNTRY_STORAGE_TIMESTAMP_KEY, Date.now().toString());
        } catch {}
      } else {
        setZoneState('egypt');
        setOriginCountryCode('EG');
      }
      setIsDetecting(false);
    });
  }, []);

  const setCountry = useCallback((code: string | null) => {
    setCountryCodeState(code);
    const newZone = code ? countryToZone(code) : 'world';
    setZoneState(newZone);
    try {
      if (code) localStorage.setItem(COUNTRY_STORAGE_KEY, code);
      else localStorage.removeItem(COUNTRY_STORAGE_KEY);
    } catch {}
  }, []);

  // Kept for backward compatibility
  const setZone = useCallback((z: PricingZone) => {
    setZoneState(z);
    if (z === 'egypt') {
      setCountryCodeState('EG');
      try { localStorage.setItem(COUNTRY_STORAGE_KEY, 'EG'); } catch {}
    }
  }, []);

  const getProductPrice = useCallback((product: Product): PriceResult => {
    try {
      const overrides = getProductOverrides();
      const regionalPricing = overrides[product.id]?.regionalPricing ?? null;
      return resolvePrice(product.price, zone, regionalPricing, countryCode);
    } catch {
      return resolvePrice(product.price, zone, null, countryCode);
    }
  }, [zone, countryCode]);

  const formatPrice = useCallback((result: PriceResult): string => {
    const num = result.price % 1 === 0 ? result.price.toString() : result.price.toFixed(2);
    return `${num} ${result.currency}`;
  }, []);

  // Build a dynamic zoneInfo reflecting the current country's currency
  const zoneInfo: ZoneInfo = zone === 'egypt'
    ? ZONES.egypt
    : countryCode && COUNTRY_CURRENCIES[countryCode]
      ? {
          zone: 'world',
          currency: COUNTRY_CURRENCIES[countryCode].currency,
          currencyAr: COUNTRY_CURRENCIES[countryCode].currencyEn,
          currencyEn: COUNTRY_CURRENCIES[countryCode].currencyEn,
          label: COUNTRY_CURRENCIES[countryCode].nameAr,
          labelEn: COUNTRY_CURRENCIES[countryCode].nameEn,
          flag: COUNTRY_CURRENCIES[countryCode].flag,
        }
      : ZONES.world;

  const getCartRegionalTotal = useCallback((items: CartItem[]): { total: number; currency: string; currencyEn: string } => {
    if (items.length === 0) return { total: 0, currency: zoneInfo.currencyAr, currencyEn: zoneInfo.currencyEn };
    const total = items.reduce((sum, item) => {
      const priceResult = getProductPrice(item.product);
      return sum + priceResult.price * item.quantity;
    }, 0);
    const firstResult = getProductPrice(items[0].product);
    return { total: Math.round(total * 100) / 100, currency: firstResult.currency, currencyEn: firstResult.currencyEn };
  }, [getProductPrice, zoneInfo]);

  return (
    <RegionalPricingContext.Provider value={{
      zone,
      zoneInfo,
      countryCode,
      originCountryCode,
      setCountry,
      setZone,
      isDetecting,
      getProductPrice,
      formatPrice,
      getCartRegionalTotal,
    }}>
      {children}
    </RegionalPricingContext.Provider>
  );
}

export function useRegionalPricing() {
  const ctx = useContext(RegionalPricingContext);
  if (!ctx) throw new Error('useRegionalPricing must be used within RegionalPricingProvider');
  return ctx;
}
