/**
 * The reciters offered in قرآن نوري, and how each one's audio is located.
 *
 * ## Two kinds of source, one interface
 *
 * Every reciter but one is distributed the way the islamic.network CDN distributes them:
 * **one file per ayah**, named by the ayah's global number (1–6236). Playing an ayah is
 * opening its file, and the file ending is the ayah ending.
 *
 * تلاوة د. إبراهيم حسن is not distributed that way. It was recorded **one file per
 * mus'haf page** (604 of them), and playing a single ayah means seeking into that page's
 * file and stopping at a measured offset. The timings come from the
 * `Aqtar-Company/ibrahim-recitation` repository (data/ayah-timings.json, commit 534e225),
 * shipped here as `public/quran/ibrahim-timings.json`.
 *
 * `resolveAyahAudio()` hides that difference: it hands the player a URL, a start and an
 * end, and a per-ayah reciter simply comes back with start 0 and end null.
 *
 * ## What the caller must handle
 *
 * - **`null` means "this ayah cannot be played on its own."** 5459 of 6236 ayat are timed;
 *   the rest are recorded but not yet aligned. Do NOT estimate an offset by dividing the
 *   file by the ayah count — a guessed position highlights the wrong verse, and someone
 *   memorising from this screen would memorise the mistake. Play the page whole instead
 *   (`resolvePageAudio()`), or stay silent.
 * - **`end: null` means "to the end of the file."** It is the last ayah on its page. It is
 *   not zero, and it is not a number to invent.
 */

export interface Reciter {
  id: string;
  nameAr: string;
  /** Distinguishes مرتل from مجود etc. — shown under the name in the picker. */
  styleAr?: string;
  color: string;
  /**
   * `cdn-ayah`:  one file per ayah on cdn.islamic.network, keyed by GLOBAL ayah number.
   * `everyayah`: one file per ayah on everyayah.com, keyed by SURAH+AYAH, zero-padded to
   *              three digits each (2:255 → `002255.mp3`). A different host carries
   *              different masters of the same reciter, which is the only reason to use it.
   * `page-offset`: one file per mus'haf page; an ayah is a measured slice of it.
   */
  source: 'cdn-ayah' | 'everyayah' | 'page-offset';
  /** Required for `everyayah`: the directory under everyayah.com/data/. */
  dir?: string;
}

/**
 * The `cdn-ayah` ids are alquran.cloud edition identifiers. Verify every one against the
 * CDN before adding it — `ops/check-reciters.sh`, run ON THE SERVER — and read the status
 * code, because the two failures mean opposite things:
 *
 * - **404** — the id is misspelt. Fix the spelling.
 * - **403** — the id is right and the CDN REFUSES to serve that recitation. No spelling
 *   fixes it. Verified 2026-09-21: `ar.abdulbasitmurattal`, `ar.abdurrahmansudais` (and
 *   `ar.abdurrahmaansudais`), `ar.saoodshuraym`, `ar.minshawimujawwad`, `ar.hanirifai`,
 *   `ar.aymanswoaid` and `ar.abdulsamad` all answer 403. They were removed rather than
 *   left in the picker as names that play nothing — do not add them back without a fresh
 *   green run of the script.
 *
 * Every entry below returned 206 on two different ayat on 2026-09-21.
 */
export const RECITERS: Reciter[] = [
  { id: 'ar.alafasy',         nameAr: 'مشاري العفاسي',       styleAr: 'مرتل', color: '#1a6b3a', source: 'cdn-ayah' },
  { id: 'ibrahim.hassan',     nameAr: 'د. إبراهيم حسن',      styleAr: 'مرتل', color: '#8a5a00', source: 'page-offset' },
  // ليست نسخةَ الإذاعة المصرية — قُورنت بالسماع (2026-09-21) بتسجيل الإذاعة
  // المنشور على mp3quran (husr/، حفص عن عاصم مرتّل) فتبيّن أنها غيرُه. وهي
  // مع ذلك تلاوةٌ صحيحةٌ للحصري بحفص، وهي الوحيدةُ منه الموزَّعةُ بملفٍ لكل
  // آية، فبقيت باسمٍ لا يَعِد بما لا تفي به. تسجيلُ الإذاعة موزَّعٌ بملفٍ لكل
  // سورةٍ كاملة، ولا يصلح لمصحفٍ يُقرأ وجهًا وجهًا بغير محاذاةٍ تُصنع له.
  { id: 'husary.radio',       nameAr: 'محمود خليل الحصري',   styleAr: 'مرتل', color: '#1a4a8a', source: 'everyayah', dir: 'Husary_128kbps' },
  { id: 'ar.minshawi',        nameAr: 'محمد صديق المنشاوي',  styleAr: 'مرتل', color: '#5a3a00', source: 'cdn-ayah' },
  { id: 'ar.mahermuaiqly',    nameAr: 'ماهر المعيقلي',       styleAr: 'مرتل', color: '#2a1a6b', source: 'cdn-ayah' },
  { id: 'ar.shaatree',        nameAr: 'أبو بكر الشاطري',     styleAr: 'مرتل', color: '#004a4a', source: 'cdn-ayah' },
  { id: 'ar.ahmedajamy',      nameAr: 'أحمد العجمي',         styleAr: 'مرتل', color: '#6b1a1a', source: 'cdn-ayah' },
  { id: 'ar.hudhaify',        nameAr: 'علي الحذيفي',         styleAr: 'مرتل', color: '#4a2a6b', source: 'cdn-ayah' },
  { id: 'ar.muhammadayyoub',  nameAr: 'محمد أيوب',           styleAr: 'مرتل', color: '#1a5a5a', source: 'cdn-ayah' },
  { id: 'ar.muhammadjibreel', nameAr: 'محمد جبريل',          styleAr: 'مرتل', color: '#6b4a1a', source: 'cdn-ayah' },
];

/**
 * تلاوة د. إبراهيم حسن — the platform's own recitation, so it is what a member hears
 * unless they choose otherwise. Nothing persists the choice yet, so this is what every
 * session starts on.
 */
export const DEFAULT_RECITER_ID = 'ibrahim.hassan';

export function getReciter(id: string): Reciter {
  return RECITERS.find(r => r.id === id) ?? RECITERS[0];
}

// ─── إبراهيم حسن: page files + measured offsets ─────────────────────────────────────────

const IBRAHIM_BASE = 'https://ibrahimquran.com/quran/';

/**
 * Two pages are absent from the `khatma/` set and present in the by-surah set. Their
 * replacements are named with SPACES, which must be percent-encoded or the request 404s.
 * (From MISSING.md in the recitation repository.)
 */
const IBRAHIM_PAGE_FALLBACK: Record<number, string> = {
  504: 'pages/46 Page 3.mp3',
  566: 'pages/68 Page 3.mp3',
};

export function ibrahimPageUrl(page: number): string {
  const path = IBRAHIM_PAGE_FALLBACK[page] ?? `khatma/${page}.mp3`;
  return IBRAHIM_BASE + path.split('/').map(encodeURIComponent).join('/');
}

/** `[["2:255", 102.48], …]` in ascending order within each page. */
type TimingRow = [string, number];
interface TimingsFile { pages: Record<string, TimingRow[]> }

export interface AyahTiming {
  page: number;
  start: number;
  /** null = play to the end of the file (the last ayah on its page). */
  end: number | null;
}

let index: Map<string, AyahTiming> | null = null;
let timedPages: Set<number> | null = null;
let inFlight: Promise<void> | null = null;

/**
 * Fetches and indexes the timings once per session. Safe to call on every play: after the
 * first call it resolves immediately, and concurrent callers share one request.
 *
 * Never throws. A failed fetch leaves the index empty, which makes every lookup return
 * null — the player then falls back to reciting the page whole, which is the correct
 * behaviour for an unaligned page anyway.
 */
export async function loadIbrahimTimings(): Promise<void> {
  if (index) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/quran/ibrahim-timings.json');
      if (!res.ok) throw new Error(`timings ${res.status}`);
      const data = (await res.json()) as TimingsFile;
      const map = new Map<string, AyahTiming>();
      const pages = new Set<number>();
      for (const [pageStr, rows] of Object.entries(data.pages ?? {})) {
        const page = Number(pageStr);
        if (!Number.isFinite(page) || !Array.isArray(rows) || rows.length === 0) continue;
        pages.add(page);
        for (let i = 0; i < rows.length; i++) {
          const [key, start] = rows[i];
          // The end of an ayah is the start of the next one ON THE SAME PAGE. No ayah in
          // the mus'haf spans two pages (verified across all 604), so this is exact.
          const end = i + 1 < rows.length ? rows[i + 1][1] : null;
          map.set(key, { page, start, end });
        }
      }
      index = map;
      timedPages = pages;
    } catch (err) {
      console.warn('[quran-reciters] could not load إبراهيم حسن timings', err);
      index = new Map();
      timedPages = new Set();
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** True once a page is known to have per-ayah timings. Call after `loadIbrahimTimings()`. */
export function ibrahimPageIsTimed(page: number): boolean {
  return timedPages?.has(page) ?? false;
}

export function ibrahimTiming(surah: number, ayah: number): AyahTiming | null {
  return index?.get(`${surah}:${ayah}`) ?? null;
}

/**
 * Every boundary in the published timings is a forced-alignment ESTIMATE, not a measured
 * silence, and the estimate runs LATE — worst on the short light onsets: واو العطف, الفاء,
 * the opening of a surah. Because the file also publishes `end` as the next ayah's `start`,
 * a late estimate leaves the next ayah's first letter inside this ayah's tail, and the
 * listener hears it twice. It is inaudible in a page-at-a-time mus'haf app, where the number
 * only moves a highlight; it is plainly audible the moment something CUTS on it, which is
 * what this player does.
 *
 * Until `Aqtar-Company/ibrahim-recitation` republishes timings snapped to real silence
 * (`tools/snap_cuts.py`, which needs the audio and ffmpeg — as of commit 12a37ea the tool
 * is in but `data/` is unchanged), both edges are shifted back by the same amount. Shifting
 * BOTH is what makes this safe: the duration is preserved, so no ayah can be trimmed to
 * nothing, and a consecutive pair still meets with no gap and no overlap. Moving only `end`
 * — the obvious fix — eats short ayat.
 */
const ALIGNMENT_LAG = 0.15;

function shifted(t: AyahTiming): { start: number; end: number | null } {
  return {
    start: Math.max(0, t.start - ALIGNMENT_LAG),
    // null stays null: the last ayah on a page plays to the end of the file.
    end: t.end === null ? null : Math.max(0, t.end - ALIGNMENT_LAG),
  };
}

/**
 * The playable start of one ayah inside its page file, shifted exactly as
 * `resolveAyahAudio` shifts it. A player that lets the page file run UNCUT and only moves
 * the highlight needs these positions and nothing else — that is the reading mode this
 * recitation was recorded for, and the one in which a boundary estimate cannot be heard.
 */
export function ibrahimAyahStart(surah: number, ayah: number): number | null {
  const t = ibrahimTiming(surah, ayah);
  return t ? shifted(t).start : null;
}

// ─── The one thing the player calls ─────────────────────────────────────────────────────

export interface AudioSegment {
  url: string;
  /** Seconds into the file where this ayah begins. 0 for a per-ayah file. */
  start: number;
  /** Seconds where it ends, or null for "to the end of the file". */
  end: number | null;
  /** True when the segment is a whole page, not one ayah — no per-ayah highlighting. */
  wholePage: boolean;
}

export interface AyahRef {
  /** Global ayah number, 1–6236 — what the per-ayah CDN is keyed by. */
  globalId: number;
  surah: number;
  ayah: number;
  page: number;
}

/**
 * Where to find one ayah for one reciter, or null when that reciter cannot play this ayah
 * on its own (an unaligned page in إبراهيم حسن's recitation). A null answer is an
 * instruction to fall back to `resolvePageAudio()`, not an error.
 */
export function resolveAyahAudio(ref: AyahRef, reciterId: string): AudioSegment | null {
  const reciter = getReciter(reciterId);
  if (reciter.source === 'page-offset') {
    const t = ibrahimTiming(ref.surah, ref.ayah);
    if (!t) return null;
    const { start, end } = shifted(t);
    return { url: ibrahimPageUrl(t.page), start, end, wholePage: false };
  }
  if (reciter.source === 'everyayah') {
    // Keyed by surah+ayah, three digits each — NOT by the global number the other CDN uses.
    const pad = (n: number) => String(n).padStart(3, '0');
    return {
      url: `https://everyayah.com/data/${reciter.dir}/${pad(ref.surah)}${pad(ref.ayah)}.mp3`,
      start: 0,
      end: null,
      wholePage: false,
    };
  }
  return {
    url: `https://cdn.islamic.network/quran/audio/128/${reciter.id}/${ref.globalId}.mp3`,
    start: 0,
    end: null,
    wholePage: false,
  };
}

/**
 * The whole page as one segment — the fallback for a reciter recorded by page whose page
 * has no per-ayah alignment yet. Returns null for per-ayah reciters, which have no such
 * thing as a page file.
 */
export function resolvePageAudio(page: number, reciterId: string): AudioSegment | null {
  const reciter = getReciter(reciterId);
  if (reciter.source !== 'page-offset') return null;
  return { url: ibrahimPageUrl(page), start: 0, end: null, wholePage: true };
}
