'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * A thin gold bar at the top of the screen from the moment an internal link is pressed
 * until the new page is on screen.
 *
 * Every page here is rendered on request (prices, stock, sessions — force-dynamic), so a
 * client-side navigation waits on the server before anything changes. Pressing a footer
 * link at the bottom of a long page then did NOTHING visible for half a second or more:
 * no pressed state, no spinner, the same page still under the finger — reported as «مش
 * بتدي رياكشن عند الضغط». This answers the press at once, on every link in the site.
 *
 * It listens to clicks on the document (capture phase), so no link needs changing. It
 * ignores what is not a same-tab navigation to another page of this site: modifier keys,
 * target=_blank, downloads, other origins, a link to the page already open, hash-only links.
 * It finishes when the URL becomes the link's (pathname OR query — /media?kind=… changes
 * only the query), and gives up after 15 seconds so it can never hang on screen.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const target = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const clear = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; };
  const finish = () => {
    if (!target.current) return;
    target.current = null;
    clear();
    setState('done');
    timers.current.push(window.setTimeout(() => setState('idle'), 350));
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(a.href, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      // Static files (the brand PDF page, an .html deck) are full page loads; the browser shows its own.
      if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
      const to = url.pathname + url.search;
      if (to === location.pathname + location.search) return; // same page (or a #hash on it)
      target.current = to;
      clear();
      setState('loading');
      timers.current.push(window.setTimeout(finish, 15_000));
      // A query-only change does not move `pathname`; watch the URL itself.
      const poll = () => {
        if (!target.current) return;
        if (location.pathname + location.search === target.current) { finish(); return; }
        timers.current.push(window.setTimeout(poll, 150));
      };
      timers.current.push(window.setTimeout(poll, 150));
    };
    document.addEventListener('click', onClick, true);
    return () => { document.removeEventListener('click', onClick, true); clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The route changed: the new page is being rendered.
  useEffect(() => { finish(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

  if (state === 'idle') return null;
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-[400] h-[3px] pointer-events-none" dir="ltr">
      <div
        className="h-full bg-[#F5C518] shadow-[0_0_10px_#F5C518]"
        style={state === 'done'
          ? { width: '100%', opacity: 0, transition: 'opacity .3s ease .1s' }
          // Fast at first, then crawling — it must look alive for as long as the server takes.
          : { width: 0, animation: 'nav-progress 8s cubic-bezier(.08,.82,.17,1) forwards' }}
      />
    </div>
  );
}
