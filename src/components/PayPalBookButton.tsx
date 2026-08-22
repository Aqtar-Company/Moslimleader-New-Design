'use client';

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import React, { useState } from 'react';

interface PayPalBookButtonProps {
  createEndpoint: string;
  captureEndpoint: string;
  amountUsd: number;
  onSuccess: (orderId: string) => void;
  onError: (message: string) => void;
  isRtl?: boolean;
  extraBody?: Record<string, unknown>;
  createBody?: Record<string, unknown>;
}

export default function PayPalBookButton({
  createEndpoint,
  captureEndpoint,
  amountUsd,
  onSuccess,
  onError,
  isRtl = true,
  extraBody,
  createBody,
}: PayPalBookButtonProps) {
  const [processing, setProcessing] = useState(false);
  const createErrorFired = React.useRef(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return <p className="text-red-500 text-sm text-center">{isRtl ? 'PayPal غير مُعَد' : 'PayPal not configured'}</p>;
  }

  const createOrder = async () => {
    createErrorFired.current = false;
    const res = await fetch(createEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...(createBody ? { body: JSON.stringify(createBody) } : {}),
    });
    let data: Record<string, unknown> = {};
    try {
      data = await res.json();
    } catch {
      const msg = isRtl ? 'خطأ في الخادم، حاول مرة أخرى' : 'Server error, please try again';
      createErrorFired.current = true;
      onError(msg);
      throw new Error(msg);
    }
    if (!res.ok) {
      const msg = (data.error as string) || 'Failed to create PayPal order';
      createErrorFired.current = true;
      onError(msg);
      throw new Error(msg);
    }
    return data.paypalOrderId as string;
  };

  const onApprove = async (data: { orderID: string }) => {
    setProcessing(true);
    try {
      const res = await fetch(captureEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paypalOrderId: data.orderID, ...extraBody }),
      });
      let result: Record<string, unknown> = {};
      try {
        result = await res.json();
      } catch {
        throw new Error(isRtl ? 'خطأ في الخادم، حاول مرة أخرى' : 'Server error, please try again');
      }
      if (!res.ok) throw new Error((result.error as string) || 'Payment capture failed');
      onSuccess((result.orderId as string) ?? '');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'حدث خطأ في تأكيد الدفع');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 text-center">
        {isRtl ? 'سيتم الدفع بالدولار عبر PayPal:' : 'Payment will be processed in USD via PayPal:'}{' '}
        <strong>${amountUsd.toFixed(2)} USD</strong>
      </div>

      {processing && (
        <div className="flex items-center justify-center gap-2 mb-3 text-sm text-gray-600">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {isRtl ? 'جاري تأكيد الدفع وتفعيل الوصول...' : 'Confirming payment and granting access...'}
        </div>
      )}

      <PayPalScriptProvider
        options={{
          clientId,
          currency: 'USD',
          intent: 'capture',
          components: 'buttons',
          disableFunding: 'paylater,venmo',
        }}
      >
        {/* Card button first — majority of users pay by card */}
        <PayPalButtons
          fundingSource="card"
          style={{ layout: 'vertical', shape: 'rect', label: 'pay', color: 'black', height: 48 }}
          disabled={processing}
          createOrder={createOrder}
          onApprove={onApprove}
          onCancel={() => onError(isRtl ? 'تم إلغاء الدفع' : 'Payment cancelled')}
          onError={(err) => {
            console.error('[PayPal Card error]', err);
            if (!createErrorFired.current) onError(isRtl ? 'حدث خطأ في الدفع بالبطاقة' : 'Card payment error');
            createErrorFired.current = false;
          }}
        />

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
            {isRtl ? 'أو' : 'Or'}
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <PayPalButtons
          fundingSource="paypal"
          style={{ layout: 'vertical', shape: 'rect', label: 'paypal', color: 'gold', height: 48 }}
          disabled={processing}
          createOrder={createOrder}
          onApprove={onApprove}
          onCancel={() => onError(isRtl ? 'تم إلغاء الدفع' : 'Payment cancelled')}
          onError={(err) => {
            console.error('[PayPal error]', err);
            if (!createErrorFired.current) onError(isRtl ? 'حدث خطأ في PayPal' : 'PayPal error occurred');
            createErrorFired.current = false;
          }}
        />
      </PayPalScriptProvider>

      <p className="mt-3 text-[10px] text-gray-400 text-center">
        {isRtl ? '🔒 الدفع آمن ومشفر عبر PayPal' : '🔒 Secure payment processed by PayPal'}
      </p>
    </div>
  );
}
