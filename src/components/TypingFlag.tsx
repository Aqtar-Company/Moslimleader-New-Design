'use client';
import { useEffect } from 'react';

/**
 * Marks `<html data-typing>` while a text field has focus, so the floating launchers
 * (Ameen, WhatsApp) can step aside. On a phone the keyboard pushes them up the screen and
 * they land on top of the very box being typed in — the comment field, a form, a search.
 * The CSS that uses the flag is in globals.css («Floating launchers while typing»).
 */
const TEXT_INPUT = /^(text|search|email|tel|url|password|number|)$/;

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT.test(el.type) && !el.readOnly && !el.disabled;
  return (el as HTMLElement).isContentEditable === true;
}

export default function TypingFlag() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      if (isTextField(document.activeElement)) root.setAttribute('data-typing', '');
      else root.removeAttribute('data-typing');
    };
    // focusout fires before the next field's focusin; read the settled state a tick later
    // so moving from one field to the next does not flash the buttons back in.
    const onOut = () => window.setTimeout(sync, 60);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', onOut);
      root.removeAttribute('data-typing');
    };
  }, []);
  return null;
}
