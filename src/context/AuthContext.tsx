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
  role?: string;
  savedAddresses?: Address[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string, phone?: string) => Promise<{ error?: string }>;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const buf = new TextEncoder().encode(password);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

type UsersStore = Record<string, { password: string; user: User }>;

function getUsers(): UsersStore {
  try {
    const raw = localStorage.getItem('ml_users');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveUsers(users: UsersStore) {
  localStorage.setItem('ml_users', JSON.stringify(users));
}

function getSession(): User | null {
  try {
    const raw = localStorage.getItem('ml_session');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSession(user: User) {
  localStorage.setItem('ml_session', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('ml_session');
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(getSession());
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const key = email.toLowerCase().trim();
      const users = getUsers();
      const entry = users[key];
      if (!entry) return { error: 'بيانات الدخول غير صحيحة' };
      const hash = await hashPassword(password);
      if (hash !== entry.password) return { error: 'بيانات الدخول غير صحيحة' };
      saveSession(entry.user);
      setUser(entry.user);
      return {};
    } catch {
      return { error: 'حدث خطأ، حاول مرة أخرى' };
    }
  };

  const signUp = async (name: string, email: string, password: string, phone?: string) => {
    try {
      if (!name || !email || !password) return { error: 'جميع الحقول مطلوبة' };
      if (password.length < 6) return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
      const key = email.toLowerCase().trim();
      const users = getUsers();
      if (users[key]) return { error: 'البريد الإلكتروني مسجل بالفعل' };
      const passwordHash = await hashPassword(password);
      const newUser: User = {
        id: Date.now().toString(),
        name: name.trim(),
        email: key,
        phone: phone?.trim() || undefined,
        role: 'customer',
        savedAddresses: [],
      };
      users[key] = { password: passwordHash, user: newUser };
      saveUsers(users);
      saveSession(newUser);
      setUser(newUser);
      return {};
    } catch {
      return { error: 'حدث خطأ، حاول مرة أخرى' };
    }
  };

  const signOut = () => {
    clearSession();
    setUser(null);
  };

  const updateUser = async (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    const users = getUsers();
    const key = user.email;
    if (users[key]) {
      users[key].user = updated;
      saveUsers(users);
    }
    saveSession(updated);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
