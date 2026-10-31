'use client';
import { useEffect } from 'react';
import { initDeck } from './deck-runtime';

/** Starts the page's behaviour (tabs, presentation mode, wizard) and stops it on leave. */
export default function DeckRuntime() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.sv');
    if (!root) return;
    return initDeck(root);
  }, []);
  return null;
}
