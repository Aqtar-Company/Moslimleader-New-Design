'use client';

import { useRegionalPricing } from '@/context/RegionalPricingContext';
import type { Product } from '@/types';

interface Props {
  price: number;
  priceUsd?: number;
}

export default function RelatedProductPrice({ price, priceUsd }: Props) {
  const { getProductPrice, formatPrice } = useRegionalPricing();
  const result = getProductPrice({ price, priceUsd } as Product);
  return (
    <p className="text-base font-black text-[#1a1a2e] mt-2">
      {formatPrice(result)}
    </p>
  );
}
