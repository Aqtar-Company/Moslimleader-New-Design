'use client';

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useState } from 'react';

interface PayPalCheckoutButtonProps {
  items: {
    productId: string;
    quantity: number;
    selectedModel?: number;
    unitPrice: number;
    productName: string;
    productImage?: string;
  }[];
  shippingCost: number;
  discount: number;
  couponCode?: string;
  currency: string;
  shippingAddress: Record<string, unknown>;
  notes?: string;
  onSuccess: (orderId: string) => void;
  onError: (message: string) => void;
  isRtl: boolean;
}

export default function PayPalCheckoutButton({
  items,
  shippingCost,
  discount,
  couponCode,
  currency,
  shippingAddress,
  notes,
  onSuccess,
  onError,
  isRtl,
}: PayPalCheckoutButtonProps) {
  const [processing, setProcessing] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!clientId) {
    return <p className="text-red-500 text-sm">{isRtl ? 'PayPal غير مُعَد' : 'PayPal not configured'}</p>;
  }

  return (
    <div className="w-full">
      {processing && (
        <div className="flex items-center justify-center gap-2 mb-3 text-sm text-gray-600">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {isRtl ? 'جاري تأكيد الدفع...' : 'Confirming payment...'}
        </div>
      )}
      <PayPalScriptProvider options={{ clientId, currency: currency === 'EGP' ? 'USD' : currency }}>
        <PayPalButtons
          style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
          disabled={processing}
          createOrder={async () => {
            try {
              const res = await fetch('/api/paypal/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ items, shippingCost, discount, currency }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed to create PayPal order');
              return data.paypalOrderId;
            } catch (err) {
              onError(err instanceof Error ? err.message : 'حدث خطأ');
              throw err;
            }
          }}
          onApprove={async (data) => {
            setProcessing(true);
            try {
              const res = await fetch('/api/paypal/capture-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  paypalOrderId: data.orderID,
                  items,
                  shippingAddress,
                  shippingCost,
                  discount,
                  couponCode,
                  notes,
                  currency,
                }),
              });
              const result = await res.json();
              if (!res.ok) throw new Error(result.error || 'Payment capture failed');
              onSuccess(result.orderId);
            } catch (err) {
              onError(err instanceof Error ? err.message : 'حدث خطأ في تأكيد الدفع');
            } finally {
              setProcessing(false);
            }
          }}
          onCancel={() => {
            onError(isRtl ? 'تم إلغاء الدفع' : 'Payment cancelled');
          }}
          onError={(err) => {
            console.error('[PayPal error]', err);
            onError(isRtl ? 'حدث خطأ في PayPal' : 'PayPal error occurred');
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
