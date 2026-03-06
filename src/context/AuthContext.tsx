'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

function getUsers(): Record<string, { password: string; user: User }> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveUsers(users: Record<string, { password: string; user: User }>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const users = getUsers();
      const found = users[session];
      if (found) setUser(found.user);
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const users = getUsers();
    const key = email.toLowerCase();
    const record = users[key];
    if (!record) return { error: 'البريد الإلكتروني غير مسجل' };
    if (record.password !== password) return { error: 'كلمة المرور غير صحيحة' };
    setUser(record.user);
    localStorage.setItem(SESSION_KEY, key);
    return {};
  };

  const signUp = async (name: string, email: string, password: string, phone?: string) => {
    const users = getUsers();
    const key = email.toLowerCase();
    if (users[key]) return { error: 'البريد الإلكتروني مسجل بالفعل' };
    const newUser: User = { id: Date.now().toString(), name, email: key, phone, savedAddresses: [] };
    users[key] = { password, user: newUser };
    saveUsers(users);
    setUser(newUser);
    localStorage.setItem(SESSION_KEY, key);
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
