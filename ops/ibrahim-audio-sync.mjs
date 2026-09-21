/**
 * Watch — and optionally mirror — تلاوة د. إبراهيم حسن's page files.
 *
 *   node ops/ibrahim-audio-sync.mjs              # report what changed since last run
 *   node ops/ibrahim-audio-sync.mjs --mirror     # also copy the changed pages to R2
 *
 * ## Why this exists
 *
 * The recitation is still being revised, and the app fetches each page straight from
 * ibrahimquran.com. So a corrected file is live for every listener the moment it is
 * replaced — automatic, with nothing to copy. That is the good half.
 *
 * The bad half is silent: **our per-ayah timings are measured against those exact bytes.**
 * Replace a page's audio and every offset on that page moves. Nothing breaks visibly — the
 * highlight simply lands on the wrong verse, and somebody memorising from that screen
 * memorises the error. No request fails, no log records it, and it would be found by
 * someone noticing that the highlight is off.
 *
 * So this records each page's size and Last-Modified, and on the next run says which pages
 * changed. Those pages' timings are the ones to re-measure (`tools/snap_cuts.py` in
 * Aqtar-Company/ibrahim-recitation). That is the whole point of the script; the mirroring
 * is a convenience on top of it.
 *
 * ## State lives OUTSIDE the repo
 *
 * Deploys run `git reset --hard`, and a state file inside the working tree is one
 * `git clean` away from being lost — at which point every page reads as "new" and the
 * report says nothing. Default: /var/lib/moslimleader. Override with IBRAHIM_SYNC_STATE.
 *
 * ## Cron
 *
 *   ( crontab -l ; echo '17 4 * * * cd /home/moslimleader.com/app && node ops/ibrahim-audio-sync.mjs >> /var/log/ibrahim-audio-sync.log 2>&1' ) | crontab -
 *
 * Read `crontab -l` FIRST. This server's crontab also carries CyberPanel's backups,
 * certbot renewal and another project's scheduler; a filtered rewrite has silently deleted
 * real lines here before.
 */

import fs from 'node:fs';
import path from 'node:path';

const TOTAL_PAGES = 604;
const CONCURRENCY = 6;

const BASE = (process.env.IBRAHIM_AUDIO_SOURCE || 'https://ibrahimquran.com/quran/').replace(/\/*$/, '/');
const STATE_DIR = process.env.IBRAHIM_SYNC_STATE || '/var/lib/moslimleader';
const STATE_FILE = path.join(STATE_DIR, 'ibrahim-audio-manifest.json');
const MIRROR = process.argv.includes('--mirror');

/**
 * Two pages are absent from `khatma/` and are served from the by-surah set under names
 * containing SPACES. Kept in step with IBRAHIM_PAGE_FALLBACK in src/lib/quran-reciters.ts —
 * if one changes, change both, or the script will watch a URL the app never requests.
 */
const FALLBACK = { 504: 'pages/46 Page 3.mp3', 566: 'pages/68 Page 3.mp3' };

function pageUrl(page) {
  const rel = FALLBACK[page] ?? `khatma/${page}.mp3`;
  return BASE + rel.split('/').map(encodeURIComponent).join('/');
}

// ── reading the env, for the R2 credentials ────────────────────────────────────────────
function loadEnv() {
  try {
    for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      if (!(k in process.env)) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — only matters for --mirror, which checks for itself */ }
}

async function head(page) {
  const url = pageUrl(page);
  try {
    // HEAD is enough and downloads nothing: a 3.6 GB recitation must not be pulled to be
    // checked. A host that refuses HEAD is reported rather than guessed at.
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!res.ok) return { page, url, error: `HTTP ${res.status}` };
    return {
      page, url,
      size: res.headers.get('content-length') ?? null,
      modified: res.headers.get('last-modified') ?? null,
      etag: res.headers.get('etag') ?? null,
    };
  } catch (e) {
    return { page, url, error: e.message };
  }
}

/** Runs `task` over `items` at most `n` at a time. 604 requests at once is a denial of service. */
async function pooled(items, n, task) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await task(items[i]);
    }
  }));
  return out;
}

/** Same bytes? Compared on the fields the host actually gives; a missing field is not a match. */
function same(a, b) {
  if (!a || !b) return false;
  if (a.etag && b.etag) return a.etag === b.etag;
  return a.size !== null && a.size === b.size && a.modified === b.modified;
}

async function mirror(changed) {
  loadEnv();
  const missing = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.log(`\n  ⚠️  لا نسخ إلى R2: ناقصٌ من .env — ${missing.join(', ')}`);
    return;
  }
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log(`\n═══ النسخ إلى R2 (${changed.length} وجه) ═══`);
  let done = 0, failed = 0;
  // One at a time: a page is several megabytes, and this shares the box with the shop.
  for (const rec of changed) {
    const rel = FALLBACK[rec.page] ?? `khatma/${rec.page}.mp3`;
    const key = `quran/ibrahim/${rel}`;
    try {
      const res = await fetch(rec.url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: 'audio/mpeg',
      }));
      done++;
      console.log(`  ✅ ${String(rec.page).padStart(3)} → ${key}  (${(body.length / 1048576).toFixed(1)}MB)`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${String(rec.page).padStart(3)} — ${e.message}`);
    }
  }
  console.log(`\n  نُسخ ${done}، فشل ${failed}.`);
  if (done && process.env.R2_PUBLIC_URL) {
    console.log('\n  ولتشغيل التلاوة من R2 بدل استضافتهم، ضَع في .env ثم أعد البناء:');
    console.log(`    NEXT_PUBLIC_IBRAHIM_AUDIO_BASE=${process.env.R2_PUBLIC_URL.replace(/\/+$/, '')}/quran/ibrahim/`);
    console.log('  (قيمةٌ NEXT_PUBLIC تُدمج وقت البناء — pm2 restart وحده لا يكفي.)');
  }
}

(async () => {
  console.log(`المصدر: ${BASE}`);
  console.log(`الحالة: ${STATE_FILE}`);

  let before = {};
  let firstRun = true;
  try {
    before = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).pages ?? {};
    firstRun = Object.keys(before).length === 0;
  } catch { /* first run */ }

  const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
  const now = await pooled(pages, CONCURRENCY, head);

  const errors = now.filter(r => r.error);
  const changed = [];
  const added = [];
  for (const rec of now) {
    if (rec.error) continue;
    const prev = before[rec.page];
    if (!prev) { added.push(rec); continue; }
    if (!same(prev, rec)) changed.push(rec);
  }

  console.log();
  if (firstRun) {
    console.log(`═══ أول تشغيل: سُجّل ${now.length - errors.length} وجهًا كخطِّ أساس ═══`);
    console.log('  لا تقارنَ بعد. شغّله مرةً أخرى بعد أي تعديلٍ على الصوت ليقول ما تغيّر.');
  } else {
    console.log(`═══ ${changed.length} وجهًا تغيّر، ${added.length} جديد، ${errors.length} لا يُجيب ═══`);
    if (changed.length) {
      console.log('\n  ⚠️  توقيتاتُ هذه الأوجه صارت مشكوكًا فيها — قِيست على بايتاتٍ تبدّلت:');
      console.log('     ' + changed.map(r => r.page).join(', '));
      console.log('\n     أعِد قياسها بـ tools/snap_cuts.py في Aqtar-Company/ibrahim-recitation،');
      console.log('     ثم انسخ ayah-timings.json إلى public/quran/ibrahim-timings.json.');
      console.log('     وإلى أن يحدث ذلك، التظليلُ على هذه الأوجه يقع على الآية الخطأ.');
    }
  }
  if (errors.length) {
    console.log('\n  أوجهٌ لا تُجيب (أولُ عشرة):');
    for (const e of errors.slice(0, 10)) console.log(`     ${String(e.page).padStart(3)} — ${e.error}`);
  }

  // The baseline is written even when a page failed: a transient failure must not make the
  // next run re-report every page as changed. A page that failed keeps its previous record.
  const pagesOut = { ...before };
  for (const rec of now) {
    if (rec.error) continue;
    pagesOut[rec.page] = { size: rec.size, modified: rec.modified, etag: rec.etag };
  }
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ base: BASE, checkedAt: new Date().toISOString(), pages: pagesOut }, null, 1));
  } catch (e) {
    console.log(`\n  ⚠️  لم تُكتب الحالة (${e.message}) — كلُّ تشغيلٍ سيبدو أولَ تشغيل.`);
  }

  if (MIRROR) {
    const todo = firstRun ? now.filter(r => !r.error) : [...changed, ...added];
    if (!todo.length) console.log('\n  لا شيء لينسخ.');
    else await mirror(todo);
  }
})();
