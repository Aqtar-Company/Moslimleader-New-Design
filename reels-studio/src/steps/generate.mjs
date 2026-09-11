// الخطوة 2: مشهد -> كليب فيديو 8 ثواني من Veo
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { CONFIG, VEO_MAX_CLIP_SECONDS } from '../config.mjs';
import { ensureDir, hasContent } from '../lib/fsx.mjs';
import { log, sleep } from '../lib/log.mjs';

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 10 * 60_000; // Veo بياخد عادة 1-3 دقايق للكليب

let _client = null;
function client() {
  if (!CONFIG.geminiApiKey) {
    throw new Error(
      'GEMINI_API_KEY مش متظبط في .env\n' +
        'هاته من https://aistudio.google.com/apikey وفعّل الفوترة.\n' +
        'ملاحظة: اشتراك Google Flow لا يعطي وصول API — دول رصيدين منفصلين تماماً.',
    );
  }
  if (!_client) _client = new GoogleGenAI({ apiKey: CONFIG.geminiApiKey });
  return _client;
}

/**
 * بناء طلب Veo في مكان واحد.
 * لو Google غيّرت أسماء الحقول، ده الموضع الوحيد اللي بيتعدّل.
 * شوفه من غير ما تصرف فلوس: `node src/cli.mjs make <...> --dry-run`
 */
export function buildVeoRequest(scene, character) {
  const req = {
    model: CONFIG.veoModel,
    prompt: buildPromptText(scene),
    config: {
      aspectRatio: CONFIG.aspectRatio,
      resolution: CONFIG.resolution,
      negativePrompt: scene.negative,
      numberOfVideos: 1,
      // الفوترة بالثانية المطلوبة — فمابنطلبش 8 ونرمي نصها
      durationSeconds: scene.requestSeconds,
      generateAudio: CONFIG.audioMode === 'veo',
    },
  };

  // الصور المرجعية: دي اللي بتخلي نفس الوجه يتكرر في كل ريل.
  // بدونها كل توليد بيطلع شخص مختلف مهما كان الوصف دقيق.
  if (character.refs.length > 0) {
    req.config.referenceImages = character.refs.map((r) => ({
      image: { imageBytes: r.base64, mimeType: r.mimeType },
      referenceType: 'ASSET', // القيمة enum بحروف كبيرة — 'asset' بيترفض
    }));
  }

  return req;
}

function buildPromptText(scene) {
  const parts = [scene.fullPrompt];

  if (CONFIG.audioMode === 'veo' && scene.arabicLine) {
    // Veo 3 بيولّد صوت. بنطلب الحوار بالعربي صراحةً.
    parts.push(`The character speaks in Modern Standard Arabic: "${scene.arabicLine}"`);
    parts.push('Clear natural Arabic speech, no subtitles or text in frame.');
  } else {
    parts.push('No dialogue, ambient sound only.');
  }

  return parts.join(' ');
}

/** استعلام حالة العملية — بأكتر من اسم لأن الـ SDK غيّر التسمية بين الإصدارات. */
async function pollOperation(ai, operation) {
  if (typeof ai.operations?.getVideosOperation === 'function') {
    return ai.operations.getVideosOperation({ operation });
  }
  if (typeof ai.operations?.get === 'function') {
    return ai.operations.get({ operation });
  }
  throw new Error('نسخة @google/genai المثبتة مفيهاش ai.operations.getVideosOperation ولا ai.operations.get');
}

/** تنزيل الفيديو الناتج — ومعاه fallback لو الـ SDK مشالش helper التنزيل. */
async function downloadVideo(ai, video, destPath) {
  ensureDir(path.dirname(destPath));

  if (typeof ai.files?.download === 'function') {
    await ai.files.download({ file: video, downloadPath: destPath });
    if (hasContent(destPath)) return destPath;
    log.warn('ai.files.download رجّع ملف فاضي — بنجرب التنزيل المباشر.');
  }

  const uri = video?.uri || video?.videoUri;
  if (!uri) throw new Error('الرد مفيهوش رابط للفيديو الناتج.');

  // رابط Veo بيحتاج المفتاح في الهيدر
  const res = await fetch(uri, { headers: { 'x-goog-api-key': CONFIG.geminiApiKey } });
  if (!res.ok) throw new Error(`تنزيل الفيديو فشل: HTTP ${res.status} ${res.statusText}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('تنزيل الفيديو رجّع صفر بايت.');
  fs.writeFileSync(destPath, buf);
  return destPath;
}

/**
 * بيولّد كليب واحد لمشهد واحد.
 * لو الملف موجود بالفعل بيتخطّاه — ده اللي بيخلي إعادة التشغيل مجانية.
 */
export async function generateScene({ scene, character, outDir, force = false, dryRun = false }) {
  const dest = path.join(outDir, `scene-${String(scene.index).padStart(2, '0')}.mp4`);

  if (!force && hasContent(dest)) {
    log.info(`مشهد ${scene.index}: الكليب موجود، بنتخطّاه (مفيش تكلفة).`);
    return { path: dest, cached: true, costUsd: 0 };
  }

  const req = buildVeoRequest(scene, character);

  if (dryRun) {
    log.info(`مشهد ${scene.index} — الطلب اللي كان هيتبعت:`);
    console.log(
      JSON.stringify(
        {
          ...req,
          config: {
            ...req.config,
            referenceImages: req.config.referenceImages
              ? `<${req.config.referenceImages.length} صورة مرجعية>`
              : undefined,
          },
        },
        null,
        2,
      ),
    );
    return { path: dest, cached: false, costUsd: 0, dryRun: true };
  }

  const ai = client();
  log.step(
    `مشهد ${scene.index}: بيتولّد بـ ${CONFIG.veoModel} (${CONFIG.resolution}، ${scene.requestSeconds}ث)...`,
  );

  let operation;
  try {
    operation = await ai.models.generateVideos(req);
  } catch (e) {
    // بعض إصدارات الموديل بتقبل 8 ثواني بس. لو المدة اترفضت، نرجع لـ 8 ونقص محلياً.
    const rejectedDuration =
      scene.requestSeconds !== VEO_MAX_CLIP_SECONDS && /duration/i.test(e?.message || '');
    if (!rejectedDuration) throw e;

    log.warn(
      `الموديل رفض مدة ${scene.requestSeconds}ث — بنطلب ${VEO_MAX_CLIP_SECONDS}ث ونقص محلياً (تكلفة أعلى).`,
    );
    scene.requestSeconds = VEO_MAX_CLIP_SECONDS;
    operation = await ai.models.generateVideos(buildVeoRequest(scene, character));
  }

  const startedAt = Date.now();
  while (!operation.done) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error(`مشهد ${scene.index}: العملية تخطّت ${POLL_TIMEOUT_MS / 60000} دقيقة من غير نتيجة.`);
    }
    await sleep(POLL_INTERVAL_MS);
    operation = await pollOperation(ai, operation);
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  if (operation.error) {
    throw new Error(`مشهد ${scene.index}: Veo رجّع خطأ — ${operation.error.message || JSON.stringify(operation.error)}`);
  }

  const generated = operation.response?.generatedVideos?.[0];
  if (!generated?.video) {
    throw new Error(
      `مشهد ${scene.index}: مفيش فيديو في الرد. ` +
        'غالباً فلتر المحتوى رفض البرومبت — جرّب تبسيط وصف المشهد.',
    );
  }

  await downloadVideo(ai, generated.video, dest);

  const costUsd = scene.requestSeconds * CONFIG.costPerSecond;
  log.ok(`مشهد ${scene.index}: تم — ${path.basename(dest)} (${log.money(costUsd)})`);

  return { path: dest, cached: false, costUsd };
}
