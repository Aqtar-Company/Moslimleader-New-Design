#!/usr/bin/env node
/**
 * i18n audit — how far the site is from supporting a THIRD language.
 *
 * The site speaks Arabic and English, but most of its text is not in a translation file:
 * it is written inline as two-way choices — `isEn ? 'Hello' : 'أهلاً'`, `tx('أهلاً', 'Hello')`,
 * `isRtl ? … : …`. A third language (Turkish, Indonesian, Urdu, French…) cannot be added to
 * an either/or; every one of these has to become a key in a dictionary first. This counts
 * them, per file and per section, so the move can be done section by section and measured.
 *
 *   node ops/i18n-audit.mjs            # sections, then the 25 heaviest files
 *   node ops/i18n-audit.mjs --all      # every file
 *   node ops/i18n-audit.mjs --json     # machine-readable
 *
 * Read-only. Nothing is changed.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const PATTERNS = {
  ternary: /\bis(?:En|Rtl)\s*\?/g,          // isEn ? … : …   /  isRtl ? … : …
  tx: /\btx\(/g,                             // tx('ar', 'en')
  keyed: /\bt\(['"][\w.]+['"]\)/g,           // t('key') — already a dictionary key (good)
};
const ARABIC = /[؀-ۿ]/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map(p => {
  const s = readFileSync(p, 'utf8');
  const count = re => (s.match(re) || []).length;
  const arabicLines = s.split('\n').filter(l => ARABIC.test(l) && !/^\s*(\/\/|\*)/.test(l)).length;
  const rel = relative(ROOT, p);
  const section = rel.replace(/^src\/(app|components|lib|context)\//, '$1:').split('/')[0];
  return { file: rel, section, twoWay: count(PATTERNS.ternary) + count(PATTERNS.tx), keyed: count(PATTERNS.keyed), arabicLines };
}).filter(f => f.twoWay || f.keyed || f.arabicLines);

const bySection = {};
for (const f of files) {
  const b = bySection[f.section] ||= { section: f.section, files: 0, twoWay: 0, keyed: 0, arabicLines: 0 };
  b.files++; b.twoWay += f.twoWay; b.keyed += f.keyed; b.arabicLines += f.arabicLines;
}
const sections = Object.values(bySection).sort((a, b) => b.twoWay - a.twoWay);
const total = sections.reduce((t, s) => ({ twoWay: t.twoWay + s.twoWay, keyed: t.keyed + s.keyed, arabicLines: t.arabicLines + s.arabicLines }), { twoWay: 0, keyed: 0, arabicLines: 0 });

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, sections, files }, null, 2));
  process.exit(0);
}

const pad = (v, n) => String(v).padStart(n);
console.log(`\nTwo-way strings (must become keys before a 3rd language): ${total.twoWay}`);
console.log(`Already keyed t('…'):                                      ${total.keyed}`);
console.log(`Lines still holding Arabic text in code:                   ${total.arabicLines}\n`);
console.log('section'.padEnd(34), pad('files', 6), pad('two-way', 8), pad('keyed', 6), pad('ar-lines', 9));
for (const s of sections) console.log(s.section.padEnd(34), pad(s.files, 6), pad(s.twoWay, 8), pad(s.keyed, 6), pad(s.arabicLines, 9));
const list = files.sort((a, b) => b.twoWay - a.twoWay).slice(0, process.argv.includes('--all') ? undefined : 25);
console.log(`\n${process.argv.includes('--all') ? 'All files' : 'Heaviest 25 files'}:`);
for (const f of list) console.log(pad(f.twoWay, 5), f.file);
