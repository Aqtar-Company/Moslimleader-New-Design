'use client';

/**
 * Post and comment text, rendered: bold, italics, hashtags, and LINKS.
 *
 * ## Why it moved here
 *
 * It lived inside `TareeqCard`, so only the feed card had it. The post page and the post
 * sheet rendered `{post.content}` as raw text — the two screens where a post is actually
 * read in full — and a URL there was an unclickable string.
 *
 * ## Why bare domains count as links
 *
 * The pattern matched `https?://…` only, and people write `www.example.com` and
 * `example.com`. WhatsApp, Facebook and every chat app linkify those, so text that was
 * clickable everywhere else arrived here as plain characters.
 *
 * A bare domain cannot be matched loosely, though: Arabic prose is full of full stops with
 * no space after them, and a greedy pattern turns «الحمد لله.شاشة» into a link. So a match
 * needs EITHER a `www.` prefix or a TLD from a fixed list. That misses an unusual TLD,
 * which is the right way to be wrong — a missed link is a small loss, and a sentence
 * turned into a link is a broken paragraph.
 */

import React from 'react';

/** Common TLDs plus the Arab-world country codes this platform's members actually use. */
const TLD = [
  'com', 'net', 'org', 'io', 'me', 'co', 'app', 'dev', 'info', 'biz', 'tv', 'cc', 'link',
  'online', 'store', 'site', 'blog', 'news', 'sa', 'eg', 'ae', 'kw', 'qa', 'bh', 'om',
  'jo', 'ps', 'sy', 'lb', 'iq', 'ye', 'sd', 'ly', 'tn', 'dz', 'ma', 'tr', 'uk', 'de',
  'fr', 'gov', 'edu',
].join('|');

const PATTERN = new RegExp(
  [
    '\\*\\*([^*\\n]+?)\\*\\*',                                  // **bold**
    '\\*([^*\\n]+?)\\*',                                        // *italic*
    '#[\\w\\u0600-\\u06FF\\u0750-\\u077F]{2,}',                 // #hashtag, Arabic included
    'https?:\\/\\/[^\\s<>"\']+',                                // a full URL
    `(?:www\\.[a-z0-9-]+(?:\\.[a-z0-9-]+)+|[a-z0-9-]+\\.(?:${TLD}))(?:\\/[^\\s<>"']*)?`,
  ].map(p => `(${p})`).join('|'),
  'gi',
);

/** Trailing punctuation belongs to the sentence, not to the address. */
function trimTail(url: string): { url: string; tail: string } {
  const m = /[.,؛،:!?)\]}»"']+$/.exec(url);
  if (!m) return { url, tail: '' };
  return { url: url.slice(0, m.index), tail: m[0] };
}

export function renderRichText(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  PATTERN.lastIndex = 0;

  while ((match = PATTERN.exec(text)) !== null) {
    if (match.index > last) segments.push(text.slice(last, match.index));
    const m = match[0];

    if (m.startsWith('**')) {
      segments.push(<strong key={key++} style={{ fontWeight: 700, color: 'inherit' }}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith('*')) {
      segments.push(<em key={key++}>{m.slice(1, -1)}</em>);
    } else if (m.startsWith('#')) {
      segments.push(<span key={key++} style={{ color: 'var(--tr-gold)', fontWeight: 600 }}>{m}</span>);
    } else {
      const { url, tail } = trimTail(m);
      // A scheme is added for the href only — the reader still sees what they typed.
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      segments.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          // The whole card is a link to the post; without this, tapping a URL inside it
          // opened the post instead of the address.
          onClick={e => e.stopPropagation()}
          style={{ color: 'var(--tr-teal)', wordBreak: 'break-all', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {url}
        </a>,
      );
      if (tail) segments.push(tail);
    }
    last = match.index + m.length;
  }

  if (last < text.length) segments.push(text.slice(last));
  return segments.length ? segments : text;
}
