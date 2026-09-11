// إعدادات مركزية — كل قيمة قابلة للتعديل من .env
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

export const DIRS = {
  root: ROOT,
  characters: path.join(ROOT, 'characters'),
  scripts: path.join(ROOT, 'scripts'),
  queue: path.join(ROOT, 'queue'),
  out: path.join(ROOT, 'out'),
  assets: path.join(ROOT, 'assets'),
};

// --- موديلات Veo ---
// الحد الأقصى للكليب الواحد 8 ثواني. أي مدة أطول = كذا كليب + مونتاج.
export const VEO_MAX_CLIP_SECONDS = 8;

// المدد اللي Veo بيقبلها للكليب الواحد. الفوترة بالثانية المطلوبة،
// فطلب 4+6 لعشر ثواني بيوفّر 37% مقارنة بـ 8+8 وقص محلي.
export const VEO_ALLOWED_DURATIONS = [4, 6, 8];

export const TIERS = {
  fast: {
    model: 'veo-3.1-fast-generate-001',
    // $/ثانية — تقريبية، راجعها على صفحة أسعار Gemini API قبل أي تشغيل واسع
    costPerSecond: { '720p': 0.1, '1080p': 0.15 },
  },
  std: {
    model: 'veo-3.1-generate-001',
    costPerSecond: { '720p': 0.4, '1080p': 0.4 },
  },
};

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const tierKey = (process.env.REELS_TIER || 'fast').toLowerCase();
if (!TIERS[tierKey]) {
  throw new Error(`REELS_TIER غير معروف: "${tierKey}" — القيم المسموحة: ${Object.keys(TIERS).join(', ')}`);
}

const resolution = process.env.REELS_RESOLUTION === '1080p' ? '1080p' : '720p';
const audioMode = process.env.REELS_AUDIO_MODE === 'silent' ? 'silent' : 'veo';

export const CONFIG = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  tier: tierKey,
  veoModel: TIERS[tierKey].model,
  costPerSecond: TIERS[tierKey].costPerSecond[resolution],

  resolution,
  aspectRatio: '9:16',

  // ── بنية الريل ──────────────────────────────────────────────
  // الجزء المتحرك المولّد بـ AI (ده اللي بيتدفع فيه فلوس)
  videoSeconds: num(process.env.REELS_VIDEO_SECONDS, 10),
  // الخاتمة: كارت ثابت باللوجو — بتتعمل بـ ffmpeg محلياً، تكلفتها صفر
  outroSeconds: num(process.env.REELS_OUTRO_SECONDS, 5),
  outroLogo: process.env.REELS_OUTRO_LOGO || 'logo.png', // نسبةً لمجلد assets/
  outroBg: process.env.REELS_OUTRO_BG || '#1a1a2e',
  outroText: process.env.REELS_OUTRO_TEXT || '',
  // زووم بطيء جداً على اللوجو بدل السكون التام (0 = ثابت خالص)
  outroZoom: num(process.env.REELS_OUTRO_ZOOM, 0.04),

  maxCostUsd: num(process.env.REELS_MAX_COST_USD, 3),

  audioMode,
  burnSubtitles: process.env.REELS_BURN_SUBTITLES !== '0',
  subtitleFont: process.env.REELS_SUBTITLE_FONT || 'Noto Sans Arabic',

  // الموسيقى بتتحط كتراك واحد متصل على الريل كله (الخاتمة كمان)
  // عشان الصوت ما ينقطعش عند بداية كارت اللوجو
  music: process.env.REELS_MUSIC || '',
  musicVolume: num(process.env.REELS_MUSIC_VOLUME, 0.12),
  // فيد آوت للصوت في آخر كام ثانية
  audioFadeOutSeconds: num(process.env.REELS_AUDIO_FADEOUT, 1.5),

  // موديل Claude لتقسيم المشاهد وكتابة البرومبتات
  breakdownModel: 'claude-opus-5',

  // أبعاد الإخراج النهائي (عمودي)
  outputWidth: 1080,
  outputHeight: 1920,
  fps: 30,
};

/** المدة الكلية للريل = الجزء المتحرك + الخاتمة. */
export function totalSeconds() {
  return CONFIG.videoSeconds + CONFIG.outroSeconds;
}

/**
 * بيختار تركيبة كليبات من [4,6,8] مجموعها يغطّي المدة المطلوبة
 * بأقل هدر ممكن — وده بالظبط اللي بيتدفع فيه.
 * عند التساوي في الهدر بيفضّل عدد كليبات أقل (قطعات أقل = إيقاع أهدأ).
 *
 * 10ث -> [4,6] بالظبط.   18ث -> [4,6,8].   15ث -> [4,4,8] (16 مطلوبة، ثانية واحدة تتقص).
 */
export function planClips(videoSeconds = CONFIG.videoSeconds) {
  const target = Math.max(1, Math.ceil(videoSeconds));
  const cap = target + Math.max(...VEO_ALLOWED_DURATIONS);

  // best[s] = أقل عدد كليبات مجموعها بالظبط s
  const best = new Array(cap + 1).fill(Infinity);
  const from = new Array(cap + 1).fill(-1);
  best[0] = 0;

  for (let s = 1; s <= cap; s++) {
    for (const d of VEO_ALLOWED_DURATIONS) {
      if (s - d >= 0 && best[s - d] + 1 < best[s]) {
        best[s] = best[s - d] + 1;
        from[s] = d;
      }
    }
  }

  // أقرب مجموع قابل للتحقيق >= المطلوب (أقل هدر، ثم أقل عدد كليبات)
  let chosen = -1;
  for (let s = target; s <= cap; s++) {
    if (best[s] !== Infinity) {
      chosen = s;
      break;
    }
  }
  if (chosen === -1) return [{ requestSeconds: 8, useSeconds: videoSeconds }];

  const requested = [];
  for (let s = chosen; s > 0; s -= from[s]) requested.push(from[s]);
  requested.sort((a, b) => a - b); // الكليبات القصيرة الأول = خُطّاف أسرع

  // الهدر بيتشال من آخر كليب بالقص المحلي عشان المجموع النهائي يطابق المطلوب
  const waste = chosen - videoSeconds;
  return requested.map((d, i) => ({
    requestSeconds: d,
    useSeconds: i === requested.length - 1 ? Math.round((d - waste) * 100) / 100 : d,
  }));
}

export function plannedSceneCount(videoSeconds = CONFIG.videoSeconds) {
  return planClips(videoSeconds).length;
}

/**
 * التكلفة المتوقعة = مجموع الثواني *المطلوبة* من Veo × سعر الثانية.
 * الخاتمة مجانية (ffmpeg محلي).
 */
export function estimateCostUsd(clips = planClips()) {
  const billedSeconds = clips.reduce((sum, c) => sum + c.requestSeconds, 0);
  return billedSeconds * CONFIG.costPerSecond;
}
