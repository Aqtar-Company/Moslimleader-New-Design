'use client';

import { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react';
import { CartItem, Product } from '@/types';
import { DEFAULT_COUPONS } from '@/lib/admin-config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; qty?: number }
  | { type: 'REMOVE_ITEM'; productId: string }
  | { type: 'UPDATE_QTY'; productId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; items: CartItem[] };

interface CartContextValue {
  items: CartItem[];
  total: number;
  totalItems: number;
  coupon: { code: string; pct: number } | null;
  discount: number;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  clear: () => void;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

let _counter = 0;

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const cartItemId = `item-${Date.now()}-${_counter++}`;
      const newItem: CartItem = {
        product: { ...action.product, id: cartItemId },
        quantity: action.qty ?? 1,
      };
      return { items: [...state.items, newItem] };
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter(i => i.product.id !== action.productId) };
    case 'UPDATE_QTY':
      if (action.quantity <= 0) {
        return { items: state.items.filter(i => i.product.id !== action.productId) };
      }
      return {
        items: state.items.map(i =>
          i.product.id === action.productId ? { ...i, quantity: action.quantity } : i
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [coupon, setCoupon] = useState<{ code: string; pct: number } | null>(null);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml-cart');
      if (saved) dispatch({ type: 'LOAD', items: JSON.parse(saved) });
    } catch {}
  }, []);

  // Load saved coupon
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml-coupon');
      if (saved) setCoupon(JSON.parse(saved));
    } catch {}
  }, []);

  // Persist cart
  useEffect(() => {
    localStorage.setItem('ml-cart', JSON.stringify(state.items));
  }, [state.items]);

  const total = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const discount = coupon ? Math.round(total * coupon.pct / 100) : 0;

  const applyCoupon = (code: string): boolean => {
    const coupons = getActiveCoupons();
    const upper = code.trim().toUpperCase();
    const pct = coupons[upper];
    if (!pct) return false;
    const applied = { code: upper, pct };
    setCoupon(applied);
    localStorage.setItem('ml-coupon', JSON.stringify(applied));
    return true;
  };

  const removeCoupon = () => {
    setCoupon(null);
    localStorage.removeItem('ml-coupon');
  };

  const clear = () => {
    dispatch({ type: 'CLEAR' });
    removeCoupon();
  };

  return (
    <CartContext.Provider value={{
      items: state.items,
      total,
      totalItems,
      coupon,
      discount,
      addItem: (product, qty) => dispatch({ type: 'ADD_ITEM', product, qty }),
      removeItem: (productId) => dispatch({ type: 'REMOVE_ITEM', productId }),
      updateQty: (productId, quantity) => dispatch({ type: 'UPDATE_QTY', productId, quantity }),
      clear,
      applyCoupon,
      removeCoupon,
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
