'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { detectZone, resolvePrice, PricingZone, PriceResult, ZONES, ZoneInfo } from '@/lib/geo-pricing';
import { getProductOverrides } from '@/lib/admin-storage';
import { Product } from '@/types';
import { CartItem } from '@/types';

const ZONE_STORAGE_KEY = 'ml-pricing-zone';
const VALID_ZONES: PricingZone[] = ['egypt', 'saudi', 'world'];

interface RegionalPricingContextValue {
  zone: PricingZone;
  zoneInfo: ZoneInfo;
  setZone: (zone: PricingZone) => void;
  isDetecting: boolean;
  getProductPrice: (product: Product) => PriceResult;
  formatPrice: (result: PriceResult) => string;
  getCartRegionalTotal: (items: CartItem[]) => { total: number; currency: string; currencyEn: string };
}

const RegionalPricingContext = createContext<RegionalPricingContextValue | null>(null);

export function RegionalPricingProvider({ children }: { children: ReactNode }) {
  const [zone, setZoneState] = useState<PricingZone>('egypt');
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    // Check saved preference first
    try {
      const saved = localStorage.getItem(ZONE_STORAGE_KEY);
      if (saved && VALID_ZONES.includes(saved as PricingZone)) {
        setZoneState(saved as PricingZone);
        setIsDetecting(false);
        return;
      }
    } catch {}

    // Auto-detect from IP
    detectZone().then(detected => {
      setZoneState(detected);
      setIsDetecting(false);
    });
  }, []);

  const setZone = useCallback((z: PricingZone) => {
    setZoneState(z);
    try { localStorage.setItem(ZONE_STORAGE_KEY, z); } catch {}
  }, []);

  const getProductPrice = useCallback((product: Product): PriceResult => {
    try {
      const overrides = getProductOverrides();
      const regionalPricing = overrides[product.id]?.regionalPricing ?? null;
      return resolvePrice(product.price, zone, regionalPricing);
    } catch {
      return resolvePrice(product.price, zone, null);
    }
  }, [zone]);

  const formatPrice = useCallback((result: PriceResult): string => {
    const num = result.price % 1 === 0 ? result.price.toString() : result.price.toFixed(2);
    return `${num} ${result.currency}`;
  }, []);

  const getCartRegionalTotal = useCallback((items: CartItem[]): { total: number; currency: string; currencyEn: string } => {
    if (items.length === 0) return { total: 0, currency: ZONES[zone].currencyAr, currencyEn: ZONES[zone].currencyEn };
    const total = items.reduce((sum, item) => {
      const priceResult = getProductPrice(item.product);
      return sum + priceResult.price * item.quantity;
    }, 0);
    const firstResult = getProductPrice(items[0].product);
    return { total: Math.round(total * 100) / 100, currency: firstResult.currency, currencyEn: firstResult.currencyEn };
  }, [getProductPrice, zone]);

  return (
    <RegionalPricingContext.Provider value={{
      zone,
      zoneInfo: ZONES[zone],
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
