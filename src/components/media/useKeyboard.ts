'use client';
import { useEffect, useState, type RefObject } from 'react';

/**
 * The on-screen keyboard, measured.
 *
 * A phone's keyboard does not shrink the page — it shrinks the VISUAL viewport and lays
 * itself over the bottom of the page. So a box near the bottom of the screen, or a sheet
 * fixed to the bottom, ends up underneath it: the reader taps «تعليق» and types blind.
 * `window.visualViewport` is the only thing that knows where the visible part is.
 */

/** Pixels the keyboard covers at the bottom of the layout viewport (0 when closed). */
export function useKeyboardInset(active = true): { inset: number; visibleHeight: number | null } {
  const [state, setState] = useState<{ inset: number; visibleHeight: number | null }>({ inset: 0, visibleHeight: null });
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv || !active) { setState({ inset: 0, visibleHeight: null }); return; }
    const read = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Under ~80px is browser chrome moving, not a keyboard.
      setState({ inset: inset > 80 ? inset : 0, visibleHeight: Math.round(vv.height) });
    };
    read();
    vv.addEventListener('resize', read);
    vv.addEventListener('scroll', read);
    return () => { vv.removeEventListener('resize', read); vv.removeEventListener('scroll', read); };
  }, [active]);
  return state;
}

/**
 * Keeps `ref` (a writer: the box AND its send button) inside the visible part of the screen
 * while something in it has focus — when it gains focus, and again when the keyboard opens
 * and the visible area shrinks. Scrolls the PAGE; inside a fixed sheet use useKeyboardInset.
 */
export function useKeepAboveKeyboard(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;

    // `ref.current` is read at the moment, never captured: the writer is rendered only
    // once the session is known, which is after this effect first runs.
    const fit = () => {
      const el = ref.current;
      if (!el || !el.contains(document.activeElement)) return;
      const r = el.getBoundingClientRect();
      // The visible band, in the same coordinates as getBoundingClientRect.
      const top = (vv?.offsetTop ?? 0) + 88; // clear of the fixed site header
      const bottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - 12;
      if (r.top >= top && r.bottom <= bottom) return;
      const room = bottom - top;
      // Centred in what is visible when it fits; otherwise its top edge (the box) first.
      const target = r.height <= room ? top + (room - r.height) / 2 : top;
      window.scrollBy({ top: r.top - target, behavior: 'smooth' });
    };

    let timer: number | undefined;
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(fit, 320); };
    document.addEventListener('focusin', later);
    vv?.addEventListener('resize', later);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', later);
      vv?.removeEventListener('resize', later);
    };
  }, [ref]);
}
