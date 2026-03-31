'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-[#1a1a2e] border-[#F5C518] text-white',
  error:   'bg-red-600 border-red-400 text-white',
  info:    'bg-[#1a1a2e] border-white/30 text-white',
  warning: 'bg-amber-500 border-amber-300 text-white',
};

const TYPE_ICON: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, leaving: true } : t)
    );
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 350);
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = ++counter.current;
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.slice(-3); // max 3
    });
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Portal-style fixed container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 z-[200] flex flex-col gap-2 items-center sm:items-end pointer-events-none"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-bold min-w-[220px] max-w-[90vw] sm:max-w-xs ${TYPE_STYLES[toast.type]}`}
            style={{
              animation: toast.leaving
                ? 'toast-out 0.3s ease-in forwards'
                : 'toast-in 0.28s ease-out',
            }}
          >
            <span className="text-base leading-none">{TYPE_ICON[toast.type]}</span>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition text-lg leading-none"
              aria-label="إغلاق"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
