'use client';

import { createContext, useContext, useReducer, useEffect, useState, useRef, ReactNode } from 'react';
import { CartItem, Product } from '@/types';
import { DEFAULT_COUPONS } from '@/lib/admin-config';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
}

let _counter = 0;
function makeCartItemId() {
  return `item-${Date.now()}-${_counter++}`;
}

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; selectedModel?: number; qty: number }
  | { type: 'REMOVE_ITEM'; cartItemId: string }
  | { type: 'UPDATE_QTY'; cartItemId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; items: CartItem[] };

interface CartContextValue {
  items: CartItem[];
  total: number;
  totalItems: number;
  coupon: { code: string; pct: number } | null;
  discount: number;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  addItem: (product: Product, selectedModel?: number, qty?: number) => void;
  removeItem: (cartItemId: string) => void;
  updateQty: (cartItemId: string, quantity: number) => void;
  clear: () => void;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingIdx = state.items.findIndex(
        i => i.product.id === action.product.id && i.selectedModel === action.selectedModel
      );
      if (existingIdx >= 0) {
        const newItems = [...state.items];
        newItems[existingIdx] = { ...newItems[existingIdx], quantity: newItems[existingIdx].quantity + action.qty };
        return { items: newItems };
      }
      const cartItemId = makeCartItemId();
      return {
        items: [...state.items, { cartItemId, product: action.product, quantity: action.qty, selectedModel: action.selectedModel }],
      };
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter(i => i.cartItemId !== action.cartItemId) };
    case 'UPDATE_QTY':
      if (action.quantity <= 0) {
        return { items: state.items.filter(i => i.cartItemId !== action.cartItemId) };
      }
      return {
        items: state.items.map(i =>
          i.cartItemId === action.cartItemId ? { ...i, quantity: action.quantity } : i
        ),
      };
    case 'CLEAR':
      return { items: [] };
    case 'LOAD':
      return { items: action.items };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

function getActiveCoupons(): Record<string, number> {
  if (typeof window === 'undefined') return DEFAULT_COUPONS;
  try {
    const saved = localStorage.getItem('ml-coupons');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_COUPONS };
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiAddItem(productId: string, quantity: number, selectedModel?: number) {
  await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productId, quantity, selectedModel }),
  });
}

async function apiRemoveItem(cartItemId: string) {
  await fetch(`/api/cart/${cartItemId}`, { method: 'DELETE', credentials: 'include' });
}

async function apiUpdateQty(cartItemId: string, quantity: number) {
  await fetch(`/api/cart/${cartItemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ quantity }),
  });
}

async function apiClearCart() {
  await fetch('/api/cart', { method: 'DELETE', credentials: 'include' });
}

async function apiLoadCart(): Promise<CartItem[]> {
  try {
    const res = await fetch('/api/cart', { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [coupon, setCoupon] = useState<{ code: string; pct: number } | null>(null);
  const { user, isLoading: authLoading } = useAuth();
  const prevUserId = useRef<string | null>(null);

  // Load cart: from server if logged in, from localStorage if guest
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Logged in: load from server, then merge any guest items
      const guestItems: CartItem[] = (() => {
        try {
          const raw = localStorage.getItem('ml-cart');
          return raw ? JSON.parse(raw) : [];
        } catch { return []; }
      })();

      apiLoadCart().then(serverItems => {
        // Merge: server items take precedence, guest items added if not already present
        const merged = [...serverItems];
        guestItems.forEach(gItem => {
          const alreadyIn = merged.some(
            s => s.product.id === gItem.product.id && s.selectedModel === gItem.selectedModel
          );
          if (!alreadyIn) {
            merged.push(gItem);
            // Sync guest item to server
            apiAddItem(gItem.product.id, gItem.quantity, gItem.selectedModel).catch(() => {});
          }
        });
        dispatch({ type: 'LOAD', items: merged });
        localStorage.removeItem('ml-cart'); // clear guest cart after merge
      });

      prevUserId.current = user.id;
    } else {
      // Guest: load from localStorage
      if (prevUserId.current) {
        // Just logged out — clear state
        dispatch({ type: 'CLEAR' });
        prevUserId.current = null;
        return;
      }
      try {
        const saved = localStorage.getItem('ml-cart');
        if (saved) dispatch({ type: 'LOAD', items: JSON.parse(saved) });
      } catch {}
    }

    // Load coupon from localStorage
    try {
      const savedCoupon = localStorage.getItem('ml-coupon');
      if (savedCoupon) setCoupon(JSON.parse(savedCoupon));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Persist to localStorage for guest users
  useEffect(() => {
    if (!user) {
      try { localStorage.setItem('ml-cart', JSON.stringify(state.items)); } catch {}
    }
  }, [state.items, user]);

  const total = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const discount = coupon ? Math.round(total * coupon.pct / 100) : 0;

  function applyCoupon(code: string): boolean {
    const coupons = getActiveCoupons();
    const upper = code.trim().toUpperCase();
    const pct = coupons[upper];
    if (!pct) return false;
    const c = { code: upper, pct };
    setCoupon(c);
    try { localStorage.setItem('ml-coupon', JSON.stringify(c)); } catch {}
    return true;
  }

  function removeCoupon() {
    setCoupon(null);
    try { localStorage.removeItem('ml-coupon'); } catch {}
  }

  function addItem(product: Product, selectedModel?: number, qty = 1) {
    dispatch({ type: 'ADD_ITEM', product, selectedModel, qty });
    if (user) {
      apiAddItem(product.id, qty, selectedModel).catch(() => {});
    }
  }

  function removeItem(cartItemId: string) {
    dispatch({ type: 'REMOVE_ITEM', cartItemId });
    if (user) {
      apiRemoveItem(cartItemId).catch(() => {});
    }
  }

  function updateQty(cartItemId: string, quantity: number) {
    dispatch({ type: 'UPDATE_QTY', cartItemId, quantity });
    if (user) {
      if (quantity <= 0) {
        apiRemoveItem(cartItemId).catch(() => {});
      } else {
        apiUpdateQty(cartItemId, quantity).catch(() => {});
      }
    }
  }

  function clear() {
    dispatch({ type: 'CLEAR' });
    removeCoupon();
    if (user) {
      apiClearCart().catch(() => {});
    }
  }

  return (
    <CartContext.Provider value={{
      items: state.items,
      total,
      totalItems,
      coupon,
      discount,
      applyCoupon,
      removeCoupon,
      addItem,
      removeItem,
      updateQty,
      clear,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
