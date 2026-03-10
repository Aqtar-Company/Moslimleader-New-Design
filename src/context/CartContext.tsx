'use client';

import { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react';
import { CartItem, Product } from '@/types';

export const COUPONS: Record<string, number> = {
  'MOSLIM10': 10,
  'RAMADAN20': 20,
  'WELCOME15': 15,
  'SAVE25': 25,
};

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

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const cartItemId = makeCartItemId();
      return { items: [...state.items, { cartItemId, product: action.product, quantity: action.qty, selectedModel: action.selectedModel }] };
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

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [coupon, setCoupon] = useState<{ code: string; pct: number } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml-cart');
      if (saved) dispatch({ type: 'LOAD', items: JSON.parse(saved) });
      const savedCoupon = localStorage.getItem('ml-coupon');
      if (savedCoupon) setCoupon(JSON.parse(savedCoupon));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('ml-cart', JSON.stringify(state.items));
  }, [state.items]);

  const total = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const discount = coupon ? Math.round(total * coupon.pct / 100) : 0;

  function applyCoupon(code: string): boolean {
    const pct = COUPONS[code.trim().toUpperCase()];
    if (!pct) return false;
    const c = { code: code.trim().toUpperCase(), pct };
    setCoupon(c);
    try { localStorage.setItem('ml-coupon', JSON.stringify(c)); } catch {}
    return true;
  }

  function removeCoupon() {
    setCoupon(null);
    try { localStorage.removeItem('ml-coupon'); } catch {}
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
      addItem: (product, selectedModel, qty = 1) => dispatch({ type: 'ADD_ITEM', product, selectedModel, qty }),
      removeItem: (cartItemId) => dispatch({ type: 'REMOVE_ITEM', cartItemId }),
      updateQty: (cartItemId, quantity) => dispatch({ type: 'UPDATE_QTY', cartItemId, quantity }),
      clear: () => { dispatch({ type: 'CLEAR' }); removeCoupon(); },
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
