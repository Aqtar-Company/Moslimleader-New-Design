'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string | null;
  role?: string;
  permissions?: string[];
  savedAddresses?: Address[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; needsVerification?: boolean; email?: string }>;
  signUp: (name: string, email: string, password: string, phone?: string, marketingOptIn?: boolean, inviteToken?: string) => Promise<{ error?: string; needsVerification?: boolean; email?: string; membershipGranted?: boolean }>;
  signOut: () => void;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: () => {},
  updateUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const revalidate = (initial = false) => {
      fetch('/api/auth/me', { credentials: 'include' })
        .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }))
        .then(({ status, data }) => {
          if (cancelled) return;
          if (data?.user) { setUser(data.user); return; }
          // Clear on an expired/revoked session instead of leaving a stale "signed in"
          // UI whose every action fails. ONLY on 401: /api/auth/me also answers
          // `{ user: null }` with a 500 when the DB hiccups, and treating that as a
          // logout would sign people out of the whole site (cart, checkout, admin)
          // on a transient error.
          if (!initial && status === 401) setUser(null);
        })
        .catch(() => {})
        .finally(() => { if (initial && !cancelled) setIsLoading(false); });
    };
    revalidate(true);
    // Re-check when the user comes back to the tab — the 30-day JWT can expire, or be
    // revoked server-side, long before the page is ever reloaded.
    // Throttled: tab-switching is frequent, and the session doesn't change that fast.
    let lastCheck = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      revalidate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsVerification) return { error: data.error, needsVerification: true, email: data.email };
        return { error: data.error ?? 'بيانات الدخول غير صحيحة' };
      }
      setUser(data.user);
      return {};
    } catch {
      return { error: 'حدث خطأ في الاتصال بالخادم' };
    }
  };

  const signUp = async (name: string, email: string, password: string, phone?: string, marketingOptIn?: boolean, inviteToken?: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, phone, marketingOptIn, inviteToken }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error ?? 'فشل إنشاء الحساب' };
      if (data.needsVerification) return { needsVerification: true, email: data.email };
      setUser(data.user);
      if (data.membershipGranted) return { membershipGranted: true };
      return {};
    } catch {
      return { error: 'حدث خطأ في الاتصال بالخادم' };
    }
  };

  const signOut = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    setUser(null);
  };

  const updateUser = async (data: Partial<User>) => {
    try {
      const res = await fetch('/api/auth/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.user) setUser(result.user);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
