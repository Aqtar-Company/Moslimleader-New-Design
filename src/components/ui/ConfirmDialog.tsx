'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ConfirmTone = 'default' | 'danger' | 'success';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: string;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx.confirm;
}

const TONE_STYLES: Record<ConfirmTone, { ring: string; btn: string; iconBg: string; iconText: string }> = {
  default: {
    ring: 'ring-[#F5C518]/20',
    btn: 'bg-[#1a1a2e] hover:bg-[#2d1060] text-white',
    iconBg: 'bg-amber-50',
    iconText: 'text-[#F5C518]',
  },
  danger: {
    ring: 'ring-red-500/20',
    btn: 'bg-red-600 hover:bg-red-700 text-white',
    iconBg: 'bg-red-50',
    iconText: 'text-red-600',
  },
  success: {
    ring: 'ring-emerald-500/20',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
  },
};

interface PendingConfirm extends ConfirmOptions {
  resolve: (v: boolean) => void;
  closing?: boolean;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setCurrent({ ...opts, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    if (!current) return;
    current.resolve(value);
    setCurrent(prev => (prev ? { ...prev, closing: true } : prev));
    setTimeout(() => setCurrent(null), 180);
  };

  const tone = TONE_STYLES[current?.tone || 'default'];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {current && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          dir="rtl"
          style={{ animation: current.closing ? 'fade-out 0.18s ease-in forwards' : 'fade-in 0.2s ease-out' }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => close(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className={`relative bg-white rounded-2xl shadow-2xl ring-1 ${tone.ring} max-w-sm w-full overflow-hidden`}
            style={{ animation: current.closing ? 'modal-out 0.18s ease-in forwards' : 'modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className={`w-14 h-14 mx-auto rounded-full ${tone.iconBg} flex items-center justify-center mb-4`}>
                <span className={`text-2xl ${tone.iconText}`}>{current.icon || '📦'}</span>
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">{current.title}</h3>
              {current.message && (
                <p className="text-sm text-gray-500 leading-relaxed">{current.message}</p>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2.5">
              <button
                onClick={() => close(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
              >
                {current.cancelLabel || 'إلغاء'}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tone.btn}`}
              >
                {current.confirmLabel || 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
