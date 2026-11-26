#!/usr/bin/env node
/**
 * Who opened /media from a given country, and what did they get? Read-only.
 *
 *   node ops/media-hits-by-country.mjs TR        # Turkey
 *   node ops/media-hits-by-country.mjs TR /media # any path prefix
 *
 * Reads moslimleader's own nginx log (since 2026-11-15), looks up each visitor's country with
 * ip-api.com's batch endpoint (free tier, HTTP only — the same service the book tracker uses),
 * and prints every request from that country to the path: time, status, page, browser. A 200
 * means our server delivered the page; what happened after that (the song/video streaming
 * from R2) is not in this log at all.
 */
import { readdirSync, readFileSync } from 'fs';
import { gunzipSync } from 'zlib';

const CC = (process.argv[2] || 'TR').toUpperCase();
const PREFIX = process.argv[3] || '/media';
const DIR = '/var/log/nginx';

const lines = [];
for (const f of readdirSync(DIR).filter(n => n.startsWith('moslimleader.access.log'))) {
  const buf = readFileSync(`${DIR}/${f}`);
  lines.push(...(f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8').split('\n'));
}

// main format: ip - user [time] "METHOD path PROTO" status bytes "referer" "ua" ...
const RE = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;
const hits = [];
for (const l of lines) {
  const m = RE.exec(l);
  if (!m || !m[4].startsWith(PREFIX) || m[4].includes('_rsc=')) continue;
  hits.push({ ip: m[1], time: m[2], path: m[4].replace(/[?&]fbclid=[^&]*/, ''), status: m[5], ref: m[6], ua: m[7] });
}
const ips = [...new Set(hits.map(h => h.ip))];
console.log(`${hits.length} requests to ${PREFIX} from ${ips.length} addresses; looking up countries…`);

const country = new Map();
for (let i = 0; i < ips.length; i += 100) {
  const res = await fetch('http://ip-api.com/batch?fields=query,countryCode,city', {
    method: 'POST', body: JSON.stringify(ips.slice(i, i + 100)), signal: AbortSignal.timeout(15000),
  }).catch(e => { console.error('lookup failed:', e.message); return null; });
  if (!res?.ok) break;
  for (const r of await res.json()) country.set(r.query, `${r.countryCode || '??'}${r.city ? ` ${r.city}` : ''}`);
  if (i + 100 < ips.length) await new Promise(r => setTimeout(r, 4500)); // free tier: 15 batches/min
}

const byCountry = {};
for (const ip of ips) { const c = (country.get(ip) || '??').slice(0, 2); byCountry[c] = (byCountry[c] || 0) + 1; }
console.log('\nVisitors to', PREFIX, 'by country:', Object.entries(byCountry).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · '));

const mine = hits.filter(h => (country.get(h.ip) || '').startsWith(CC));
console.log(`\n== ${CC}: ${mine.length} request(s) ==`);
for (const h of mine) {
  const ua = /FBAN|FBAV|FB_IAB/.test(h.ua) ? 'Facebook app' : /Instagram/.test(h.ua) ? 'Instagram app'
    : /WhatsApp/.test(h.ua) ? 'WhatsApp' : /iPhone|iPad/.test(h.ua) ? 'iPhone' : /Android/.test(h.ua) ? 'Android' : 'computer';
  console.log(`${h.time}  ${h.status}  ${country.get(h.ip)}  ${ua.padEnd(13)} ${h.path}`);
}
