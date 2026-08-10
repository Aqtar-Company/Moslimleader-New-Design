'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRegionalPricing } from '@/context/RegionalPricingContext';
import { SupportRequestModal } from './SupportRequestModal';

interface Props {
  productId: string;
  productName: string;
  productPrice: number;
  currency: string;
}

export function SupportRequestButton({ productId, productName, productPrice, currency }: Props) {
  const { user } = useAuth();
  const { zone } = useRegionalPricing();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [hasActive, setHasActive] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setEligible(null); return; }
    fetch('/api/support-requests')
      .then(r => r.json())
      .then(d => {
        const reqs: { productId: string; status: string }[] = d.requests ?? [];
        const active = reqs.find(r => r.productId === productId && ['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(r.status));
        setHasActive(!!active);
        setEligible(true);
      })
      .catch(() => setEligible(false));
  }, [user, productId]);

  // Support requests are only for Egyptian users — non-Egyptians pay higher regional
  // prices that already fund platform support; they don't apply for price assistance.
  if (zone !== 'egypt') return null;
  if (!user) return null;
  if (eligible === null) return null;

  if (done || hasActive) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <span>✓</span>
        <span>{done ? 'تم إرسال طلب الدعم — سيُراجع قريباً' : 'لديك طلب دعم نشط لهذا المنتج'}</span>
        <a href="/account/support-requests" className="underline text-green-700 text-xs mr-auto">عرض طلباتي</a>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
      >
        طلب دعم السعر
      </button>

      {open && (
        <SupportRequestModal
          productId={productId}
          productName={productName}
          productPrice={productPrice}
          currency={currency}
          onClose={() => setOpen(false)}
          onSuccess={() => { setOpen(false); setDone(true); }}
        />
      )}
    </>
  );
}
