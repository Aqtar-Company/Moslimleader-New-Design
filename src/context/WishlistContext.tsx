'use client';

import { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { Product } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { products as staticProducts } from '@/lib/products';

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

// Resolve product IDs to Product objects (DB products + static)
async function resolveIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const items: Product[] = [];
  for (const id of ids) {
    const found = staticProducts.find(p => p.id === id);
    if (found) {
      items.push(found);
    }
    // DB products could be fetched from /api/products if needed
  }
  return items;
}

async function apiGetWishlist(): Promise<string[]> {
  try {
    const res = await fetch('/api/wishlist', { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ids ?? [];
  } catch { return []; }
}

async function apiSaveWishlist(ids: string[]) {
  try {
    await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids }),
    });
  } catch {}
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wishlistReducer, { items: [] });
  const { user, isLoading: authLoading } = useAuth();
  const prevUserId = useRef<string | null>(null);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load wishlist on auth change
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Logged in: load from server, merge guest items
      const guestIds: string[] = (() => {
        try {
          const raw = localStorage.getItem('ml-wishlist');
          if (raw) {
            const parsed: Product[] = JSON.parse(raw);
            return parsed.map(p => p.id);
          }
        } catch {}
        return [];
      })();

      apiGetWishlist().then(async serverIds => {
        const merged = Array.from(new Set([...serverIds, ...guestIds]));
        const items = await resolveIds(merged);
        dispatch({ type: 'LOAD', items });
        localStorage.removeItem('ml-wishlist');
        if (guestIds.length > 0) {
          await apiSaveWishlist(merged);
        }
      });

      prevUserId.current = user.id;
    } else {
      if (prevUserId.current) {
        // Just logged out
        dispatch({ type: 'CLEAR' });
        prevUserId.current = null;
        return;
      }
      // Guest: load from localStorage
      try {
        const raw = localStorage.getItem('ml-wishlist');
        if (raw) dispatch({ type: 'LOAD', items: JSON.parse(raw) });
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Persist to localStorage for guests; debounced save to API for logged-in users
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try { localStorage.setItem('ml-wishlist', JSON.stringify(state.items)); } catch {}
    } else {
      if (pendingSave.current) clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(() => {
        apiSaveWishlist(state.items.map(p => p.id));
      }, 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.items, user, authLoading]);

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
