'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Product } from '@/types';

interface WishlistState { items: Product[] }

type WishlistAction =
  | { type: 'TOGGLE'; product: Product }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; items: Product[] };

function wishlistReducer(state: WishlistState, action: WishlistAction): WishlistState {
  switch (action.type) {
    case 'TOGGLE': {
      const exists = state.items.some(p => p.id === action.product.id);
      return {
        items: exists
          ? state.items.filter(p => p.id !== action.product.id)
          : [...state.items, action.product],
      };
    }
    case 'REMOVE':
      return { items: state.items.filter(p => p.id !== action.id) };
    case 'CLEAR':
      return { items: [] };
    case 'LOAD':
      return { items: action.items };
    default:
      return state;
  }
}

interface WishlistContextValue {
  items: Product[];
  totalItems: number;
  isWishlisted: (id: string) => boolean;
  toggle: (product: Product) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wishlistReducer, { items: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml-wishlist');
      if (saved) dispatch({ type: 'LOAD', items: JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('ml-wishlist', JSON.stringify(state.items));
  }, [state.items]);

  return (
    <WishlistContext.Provider value={{
      items: state.items,
      totalItems: state.items.length,
      isWishlisted: (id) => state.items.some(p => p.id === id),
      toggle: (product) => dispatch({ type: 'TOGGLE', product }),
      remove: (id) => dispatch({ type: 'REMOVE', id }),
      clear: () => dispatch({ type: 'CLEAR' }),
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
