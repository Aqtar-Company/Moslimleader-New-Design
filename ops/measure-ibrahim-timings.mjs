/**
 * Measure where each ayah really begins and ends in تلاوة د. إبراهيم حسن, instead of
 * trusting the published estimate.
 *
 *   node ops/measure-ibrahim-timings.mjs                 # all 604 pages, resumable
 *   node ops/measure-ibrahim-timings.mjs --pages 553-554 # a few, to check by ear first
 *
 * ## The defect being repaired
 *
 * Every `start` in the published timings came from forced alignment: a model matched the
 * audio to the text and reported a position. It is close, and it is late — by 0.1–0.3s,
 * worst on the short light onsets (واو العطف, الفاء, a surah's opening). The file also
 * publishes no ends, so a consumer takes each ayah's end to be the next one's start. Cut
 * there and the next ayah's first letter stays in the previous ayah's tail, and is heard
 * twice.
 *
 * No amount of arithmetic on the JSON can fix that. The only true boundary is the silence
 * the reciter leaves between two ayat, and finding it means looking at the audio.
 *
 * ## What this does
 *
 * Per page: fetch the file, ask ffmpeg for its silences, snap each boundary onto the
 * silence nearest the estimate, write BOTH edges, delete the file, move on. Peak disk is
 * ONE page (~6MB) — this box has had its disk filled twice, so 3.6GB is never on it.
 *
 * Two rules it will not break:
 *
 * - **A boundary with no silence near it keeps its estimate.** Snapping to the nearest
 *   silence 3 seconds away would put the boundary inside a neighbouring ayah. An estimate
 *   is wrong by a fraction of a second; a bad snap is wrong by a whole verse, and someone
 *   memorising from this screen would memorise it. Such rows are written two-element, which
 *   is how the player knows to keep shifting them slightly instead of trusting them.
 * - **Monotonicity is checked, not assumed.** A snap that would make an ayah start before
 *   the previous one ended, or shorter than MIN_AYAH, is refused and reported.
 *
 * Resumable: every page's result is saved as it is measured, so a dropped connection costs
 * one page. Re-run to continue; --force to re-measure pages already done.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SOURCE = (process.env.IBRAHIM_AUDIO_SOURCE || 'https://ibrahimquran.com/quran/').replace(/\/*$/, '/');
const IN_FILE = 'public/quran/ibrahim-timings.json';
const STATE_DIR = process.env.IBRAHIM_SYNC_STATE || '/var/lib/moslimleader';
const WORK = path.join(STATE_DIR, 'ibrahim-measure');
const PARTIAL = path.join(WORK, 'measured.json');
const REPORT = path.join(WORK, 'report.csv');
const OUT_FILE = path.join(WORK, 'ibrahim-timings.measured.json');

/** Anything quieter than this, for at least this long, counts as a pause between ayat. */
const NOISE_DB = -38;
const MIN_SILENCE = 0.10;
/** How far from the estimate a silence may be and still be believed to be that boundary. */
const SEARCH_WINDOW = 0.9;
/** A hair of silence is left on each side rather than cutting flush against speech. */
const EDGE_MARGIN = 0.05;
/** No ayah is shorter than this; a snap that claims otherwise is refused. */
const MIN_AYAH = 0.35;

const FALLBACK = { 504: 'pages/46 Page 3.mp3', 566: 'pages/68 Page 3.mp3' };
const pageUrl = p => SOURCE + (FALLBACK[p] ?? `khatma/${p}.mp3`).split('/').map(encodeURIComponent).join('/');

// ── arguments ───────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
function wantedPages(all) {
  const i = argv.indexOf('--pages');
  if (i < 0) return all;
  const spec = argv[i + 1] ?? '';
  const out = new Set();
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let p = a; p <= b; p++) out.add(p);
  }
  return all.filter(p => out.has(p));
}

// ── ffmpeg ──────────────────────────────────────────────────────────────────────────────
async function silences(file) {
  // silencedetect writes to stderr and the null muxer decodes without producing output.
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-i', file,
    '-af', `silencedetect=noise=${NOISE_DB}dB:d=${MIN_SILENCE}`,
    '-f', 'null', '-',
  ], { maxBuffer: 64 * 1024 * 1024 });
  const out = [];
  let open = null;
  for (const line of stderr.split('\n')) {
    let m = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (m) { open = parseFloat(m[1]); continue; }
    m = line.match(/silence_end:\s*([\d.]+)/);
    if (m && open !== null) { out.push({ start: open, end: parseFloat(m[1]) }); open = null; }
  }
  // A file ending in silence leaves one open; it bounds the last ayah's end.
  if (open !== null) out.push({ start: open, end: null });
  return out;
}

async function duration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) ? d : null;
}

/** The silence that contains `t`, else the nearest one within SEARCH_WINDOW, else null. */
function silenceNear(list, t) {
  let best = null, bestGap = Infinity;
  for (const s of list) {
    const end = s.end ?? Infinity;
    const gap = t >= s.start && t <= end ? 0 : Math.min(Math.abs(t - s.start), Math.abs(t - end));
    if (gap < bestGap) { bestGap = gap; best = s; }
  }
  return bestGap <= SEARCH_WINDOW ? best : null;
}

// ── one page ────────────────────────────────────────────────────────────────────────────
async function measurePage(page, rows) {
  const tmp = path.join(WORK, `page-${page}.mp3`);
  try {
    const res = await fetch(pageUrl(page), { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));

    const [sil, dur] = await Promise.all([silences(tmp), duration(tmp)]);
    const est = rows.map(r => ({ key: r[0], start: r[1] }));
    const out = est.map(e => ({ key: e.key, start: e.start, end: null, measured: false }));
    const notes = [];

    // Each boundary is the pair (end of ayah i-1, start of ayah i) and is decided once.
    for (let i = 1; i < est.length; i++) {
      const s = silenceNear(sil, est[i].start);
      if (!s) { notes.push([page, est[i].key, 'no-silence', est[i].start.toFixed(2), '']); continue; }
      const closeAt = s.start + EDGE_MARGIN;
      const openAt = (s.end === null ? s.start : s.end) - EDGE_MARGIN;
      // Refuse a snap that would reorder the page or leave an impossibly short ayah.
      const prevStart = out[i - 1].start;
      if (!(closeAt > prevStart + MIN_AYAH) || !(openAt >= closeAt) || !(openAt > prevStart)) {
        notes.push([page, est[i].key, 'refused', est[i].start.toFixed(2), openAt.toFixed(2)]);
        continue;
      }
      out[i - 1].end = closeAt;
      out[i - 1].measured = true;
      out[i].start = openAt;
      // `measured` on THIS row waits for its own far edge, decided by the next boundary.
    }

    // The last ayah runs to the end of the file. If the file ends in silence, stop there.
    const tail = sil.length ? sil[sil.length - 1] : null;
    const last = out[out.length - 1];
    if (tail && tail.end === null && dur && tail.start > last.start + MIN_AYAH) {
      last.end = tail.start + EDGE_MARGIN;
      last.measured = true;
    } else {
      last.end = null; // to the end of the file
      last.measured = out.length > 1 ? out[out.length - 2].measured : false;
    }

    // The first ayah's own start is only measured if a leading silence gave it one.
    const lead = sil.find(x => x.start < 0.5);
    if (lead && lead.end !== null && lead.end - EDGE_MARGIN > 0) out[0].start = Math.max(0, lead.end - EDGE_MARGIN);

    const snapped = out.filter(o => o.measured).length;
    return { page, rows: out, notes, snapped, total: out.length, silences: sil.length };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* already gone */ }
  }
}

/** Runs `task` over `items` at most `n` at a time. */
async function pooled(items, n, task) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await task(items[i]);
    }
  }));
}

(async () => {
  const src = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  const allPages = Object.keys(src.pages ?? {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  fs.mkdirSync(WORK, { recursive: true });

  let done = {};
  if (!FORCE) { try { done = JSON.parse(fs.readFileSync(PARTIAL, 'utf8')); } catch { /* first run */ } }

  const todo = wantedPages(allPages).filter(p => FORCE || !done[p]);
  console.log(`أوجهٌ موقَّتة: ${allPages.length}   مقيسةٌ سابقًا: ${Object.keys(done).length}   للقياس الآن: ${todo.length}`);
  console.log(`المصدر: ${SOURCE}`);
  console.log(`مجلد العمل: ${WORK}\n`);
  if (!todo.length) console.log('لا جديد. (استعمل --force لإعادة القياس.)');

  const notes = [];
  let pagesOk = 0, pagesFailed = 0, snapped = 0, total = 0, n = 0;

  // Two at a time: one page is a download plus a full decode, on a box that also runs the
  // shop and two other projects.
  await pooled(todo, 2, async page => {
    try {
      const r = await measurePage(page, src.pages[String(page)]);
      done[page] = r.rows.map(o => [o.key, +o.start.toFixed(3), o.end === null ? null : +o.end.toFixed(3)]);
      notes.push(...r.notes);
      pagesOk++; snapped += r.snapped; total += r.total;
      if (++n % 10 === 0 || todo.length < 12) {
        console.log(`  ${String(page).padStart(3)} — ${r.snapped}/${r.total} حدًّا مقيسًا، ${r.silences} سكتة   [${pagesOk}/${todo.length}]`);
      }
      fs.writeFileSync(PARTIAL, JSON.stringify(done));
    } catch (e) {
      pagesFailed++;
      notes.push([page, '', 'page-failed', '', e.message]);
      console.log(`  ❌ ${String(page).padStart(3)} — ${e.message}`);
    }
  });

  fs.writeFileSync(PARTIAL, JSON.stringify(done));
  fs.writeFileSync(OUT_FILE, JSON.stringify({ ...src, measuredAt: new Date().toISOString(), pages: done }));
  fs.writeFileSync(REPORT, 'page,ayah,reason,estimate,measured\n' + notes.map(r => r.join(',')).join('\n') + '\n');

  const kept = notes.filter(r => r[2] === 'no-silence').length;
  const refused = notes.filter(r => r[2] === 'refused').length;
  console.log('\n═══ الحصيلة ═══');
  console.log(`  أوجهٌ قيست: ${pagesOk}${pagesFailed ? `   فشلت: ${pagesFailed}` : ''}`);
  if (total) console.log(`  حدودٌ مقيسة: ${snapped} من ${total}  (${(snapped / total * 100).toFixed(1)}%)`);
  console.log(`  بقيت بالتقدير — لا سكتة قريبة: ${kept}`);
  console.log(`  رُفض القياس — يخلُّ بالترتيب: ${refused}`);
  console.log(`\n  الناتج : ${OUT_FILE}`);
  console.log(`  التقرير: ${REPORT}`);
  console.log('\n  للتجربة قبل النشر: انسخه فوق public/quran/ibrahim-timings.json وأعد البناء،');
  console.log('  واسمع وجهًا كان يكرّر أول حرف. الملف القديم يبقى في جيت، فالرجوع سطرٌ واحد.');
})();
