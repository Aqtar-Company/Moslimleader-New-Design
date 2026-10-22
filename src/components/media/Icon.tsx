/**
 * The media library's icons — one stroke style (24px grid, 2px, round caps) so every glyph
 * on these pages belongs to the same family. Emoji were the previous icons: each platform
 * draws them differently, they ignore the text colour, and they read as decoration.
 *
 * Direction-aware icons (arrows) carry `icon-dir-flip`, mirrored under `[dir=rtl]` by a plain
 * rule in globals.css — so «رجوع» points right in Arabic and left in English.
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'video' | 'audio' | 'image' | 'pdf' | 'play' | 'pause' | 'download' | 'share' | 'home'
  | 'back' | 'forward' | 'moon' | 'search' | 'upload' | 'trash' | 'edit' | 'eye' | 'check'
  | 'close' | 'zap' | 'mail' | 'external' | 'next' | 'tag' | 'grid' | 'up' | 'down' | 'loader'
  | 'alert' | 'book' | 'cart' | 'heart' | 'info' | 'badge' | 'reel' | 'comment' | 'volume' | 'mute' | 'send' | 'smile' | 'link' | 'more';

const PATHS: Record<IconName, JSX.Element> = {
  video: <><rect x="2.5" y="5" width="15" height="14" rx="2.5" /><path d="M17.5 10l4-2.5v9l-4-2.5" /></>,
  audio: <><path d="M3 14v-2a9 9 0 0118 0v2" /><rect x="3" y="14" width="4.5" height="6.5" rx="1.5" /><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5" /></>,
  image: <><rect x="3" y="3.5" width="18" height="17" rx="2.5" /><circle cx="9" cy="9.5" r="1.8" /><path d="M21 15.5l-5-5L5 20.5" /></>,
  pdf: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></>,
  download: <><path d="M12 3.5v12M7 11l5 5 5-5" /><path d="M4 20.5h16" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" /></>,
  home: <><path d="M3.5 11L12 4l8.5 7" /><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  moon: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  upload: <><path d="M12 15.5v-12M7 8l5-5 5 5" /><path d="M4 20.5h16" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12.5a2 2 0 002 1.5h6a2 2 0 002-1.5L18 7M9 7V4.5h6V7" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  zap: <path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" /></>,
  next: <><path d="M5 5l9.5 7L5 19z" fill="currentColor" stroke="none" /><path d="M18.5 5v14" /></>,
  tag: <><path d="M3.5 12.5V4a.5.5 0 01.5-.5h8.5l8 8-9 9z" /><circle cx="8" cy="8" r="1.5" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  up: <path d="M5 15l7-7 7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  loader: <path d="M12 3a9 9 0 109 9" />,
  alert: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  book: <><path d="M12 6.5C10 5 7.5 4.5 4 4.5v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-14c-3.5 0-6 .5-8 2z" /><path d="M12 6.5v14" /></>,
  cart: <><path d="M3 3.5h2.5l2.2 11h10.6l2.2-8H6.6" /><circle cx="9" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7a4.3 4.3 0 017.5 2.8C19.5 15.4 12 20 12 20z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.01" /></>,
  badge: <><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" /></>,
  reel: <><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none" /></>,
  comment: <path d="M4 5.5h16a1 1 0 011 1v10a1 1 0 01-1 1H10l-4.5 3.5V17.5H4a1 1 0 01-1-1v-10a1 1 0 011-1z" />,
  volume: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11" /></>,
  mute: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  send: <path d="M4 12l16-7.5-6 16-2.5-6.5z" />,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 007 0M9 9.5v.01M15 9.5v.01" /></>,
  link: <><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.2 1.2" /><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.2-1.2" /></>,
  more: <><circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
};

const DIR_AWARE: IconName[] = ['back', 'forward', 'next', 'send'];

export default function Icon({ name, size = 20, className = '', spin = false, ...rest }: {
  name: IconName;
  size?: number;
  className?: string;
  spin?: boolean;
} & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`${DIR_AWARE.includes(name) ? 'icon-dir-flip' : ''} ${spin ? 'animate-spin' : ''} shrink-0 ${className}`}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
