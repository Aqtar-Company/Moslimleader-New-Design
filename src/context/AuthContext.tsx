'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  savedAddresses?: Address[];
}

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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string, phone?: string) => Promise<{ error?: string }>;
  signOut: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: () => {},
  updateUser: () => {},
});

const STORAGE_KEY = 'ml_users';
const SESSION_KEY = 'ml_session';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function getUsers(): Record<string, { password: string; user: User }> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveUsers(users: Record<string, { password: string; user: User }>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function getSession(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { email, exp } = JSON.parse(raw);
    if (Date.now() > exp) { localStorage.removeItem(SESSION_KEY); return null; }
    return email;
  } catch {
    // Legacy plain string session
    const plain = localStorage.getItem(SESSION_KEY);
    if (plain && !plain.startsWith('{')) return plain;
    return null;
  }
}

function setSession(email: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email, exp: Date.now() + SESSION_TTL }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const email = getSession();
    if (email) {
      const users = getUsers();
      const found = users[email];
      if (found) setUser(found.user);
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const users = getUsers();
    const key = email.toLowerCase().trim();
    const record = users[key];

    // Generic message — don't reveal whether email exists or not
    const authError = { error: 'بيانات الدخول غير صحيحة' };

    if (!record) return authError;

    let passwordValid = false;
    if (record.password.startsWith('$2')) {
      // Already hashed with bcrypt
      passwordValid = bcrypt.compareSync(password, record.password);
    } else {
      // Legacy plain-text — compare and migrate on success
      passwordValid = record.password === password;
      if (passwordValid) {
        users[key].password = bcrypt.hashSync(password, 10);
        saveUsers(users);
      }
    }

    if (!passwordValid) return authError;

    setUser(record.user);
    setSession(key);
    return {};
  };

  const signUp = async (name: string, email: string, password: string, phone?: string) => {
    const users = getUsers();
    const key = email.toLowerCase().trim();
    if (users[key]) return { error: 'البريد الإلكتروني مسجل بالفعل' };
    const newUser: User = { id: Date.now().toString(), name: name.trim(), email: key, phone, savedAddresses: [] };
    const hashed = bcrypt.hashSync(password, 10);
    users[key] = { password: hashed, user: newUser };
    saveUsers(users);
    setUser(newUser);
    setSession(key);
    return {};
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const updateUser = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    const users = getUsers();
    const key = user.email;
    if (users[key]) {
      users[key].user = updated;
      saveUsers(users);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
