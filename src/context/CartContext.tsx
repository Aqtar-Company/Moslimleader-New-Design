'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { CartItem, Product } from '@/types';

interface CartState {
  items: CartItem[];
}

function makeCartItemId(productId: string, selectedModel?: number) {
  return selectedModel !== undefined ? `${productId}-${selectedModel}` : productId;
}

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; selectedModel?: number }
  | { type: 'REMOVE_ITEM'; cartItemId: string }
  | { type: 'UPDATE_QTY'; cartItemId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const cartItemId = makeCartItemId(action.product.id, action.selectedModel);
      const existing = state.items.find(i => i.cartItemId === cartItemId);
      if (existing) {
        return {
          items: state.items.map(i =>
            i.cartItemId === cartItemId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return { items: [...state.items, { cartItemId, product: action.product, quantity: 1, selectedModel: action.selectedModel }] };
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
  addItem: (product: Product, selectedModel?: number) => void;
  removeItem: (cartItemId: string) => void;
  updateQty: (cartItemId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ml-cart');
      if (saved) dispatch({ type: 'LOAD', items: JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('ml-cart', JSON.stringify(state.items));
  }, [state.items]);

  const total = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items: state.items,
      total,
      totalItems,
      addItem: (product, selectedModel) => dispatch({ type: 'ADD_ITEM', product, selectedModel }),
      removeItem: (cartItemId) => dispatch({ type: 'REMOVE_ITEM', cartItemId }),
      updateQty: (cartItemId, quantity) => dispatch({ type: 'UPDATE_QTY', cartItemId, quantity }),
      clear: () => dispatch({ type: 'CLEAR' }),
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
