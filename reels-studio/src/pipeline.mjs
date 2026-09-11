// يربط الخطوات: سكريبت -> مشاهد -> كليبات -> ريل نهائي
// كل خطوة بتسجّل نتيجتها في المانيفست، فالإعادة بتكمّل من حيث وقفت
// من غير ما تصرف فلوس على حاجة اتعملت قبل كده.
import path from 'node:path';
import { CONFIG, planClips, estimateCostUsd, totalSeconds } from './config.mjs';
import { ensureDir, loadManifest, saveManifest, newManifest, reelDir, slugify } from './lib/fsx.mjs';
import { loadCharacter } from './lib/character.mjs';
import { log } from './lib/log.mjs';
import { breakdownScript } from './steps/breakdown.mjs';
import { generateScene } from './steps/generate.mjs';
import { assembleReel } from './steps/assemble.mjs';

export function makeReelId(characterSlug, scriptId) {
  const date = new Date().toISOString().slice(0, 10);
  return `${date}-${slugify(characterSlug)}-${slugify(scriptId)}`;
}

/**
 * ينتج ريل واحد كامل.
 * @param {object}  o
 * @param {string}  o.characterSlug
 * @param {object}  o.script          { id, title, body, notes? }
 * @param {boolean} o.dryRun          يطبع الطلبات من غير ما يصرف
 * @param {boolean} o.force           يعيد كل الخطوات حتى الموجودة
 * @param {string}  o.reelId          لاستئناف ريل موجود
 */
export async function produceReel({ characterSlug, script, dryRun = false, force = false, reelId: existingId }) {
  const character = loadCharacter(characterSlug);
  const reelId = existingId || makeReelId(characterSlug, script.id);
  const outDir = ensureDir(reelDir(reelId));

  let manifest =
    (!force && loadManifest(reelId)) ||
    newManifest({ id: reelId, character: characterSlug, scriptId: script.id, title: script.title || script.id });

  const clips = planClips();
  const budget = estimateCostUsd(clips);
  const billedSeconds = clips.reduce((s, c) => s + c.requestSeconds, 0);

  log.info(
    `الريل "${reelId}" — ${clips.length} مشهد (${clips.map((c) => `${c.useSeconds}ث`).join(' + ')})` +
      ` + ${CONFIG.outroSeconds}ث خاتمة = ${totalSeconds()}ث`,
  );
  log.info(
    `التكلفة المتوقعة: ${log.money(budget)} — ${billedSeconds}ث مدفوعة` +
      ` (${CONFIG.veoModel} @ ${CONFIG.resolution})`,
  );

  // --- حارس الميزانية: بيقف *قبل* أي صرف، مش بعده ---
  if (!dryRun && budget > CONFIG.maxCostUsd) {
    throw new Error(
      `التكلفة المتوقعة ${budget.toFixed(2)}$ بتتخطى السقف ${CONFIG.maxCostUsd.toFixed(2)}$.\n` +
        'إما ترفع REELS_MAX_COST_USD أو تقلّل REELS_VIDEO_SECONDS أو تحوّل REELS_TIER=fast.',
    );
  }

  try {
    // ================= الخطوة 1: التقسيم =================
    if (force || !manifest.scenes?.length) {
      const { hook, scenes } = await breakdownScript({ character, script, clips });
      manifest.hook = hook;
      manifest.scenes = scenes;
      manifest.status = 'broken-down';
      saveManifest(manifest);
    } else {
      log.info(`التقسيم موجود في المانيفست (${manifest.scenes.length} مشهد) — بنتخطّاه.`);
    }

    // ================= الخطوة 2: التوليد =================
    const clipsDir = ensureDir(path.join(outDir, 'clips'));
    manifest.status = 'generating';
    saveManifest(manifest);

    for (const scene of manifest.scenes) {
      const result = await generateScene({ scene, character, outDir: clipsDir, force, dryRun });
      scene.clip = result.path;
      scene.cached = result.cached;
      manifest.spentUsd = Math.round((manifest.spentUsd + result.costUsd) * 100) / 100;
      saveManifest(manifest); // بعد كل مشهد — لو الشغل وقع، اللي اتولّد مش بيضيع

      if (manifest.spentUsd > CONFIG.maxCostUsd) {
        throw new Error(`الصرف وصل ${manifest.spentUsd.toFixed(2)}$ وتخطى السقف — اتوقف.`);
      }
    }

    if (dryRun) {
      log.ok('تجربة جافة خلصت — مفيش أي صرف. شيل --dry-run للتوليد الحقيقي.');
      manifest.status = 'dry-run';
      saveManifest(manifest);
      return manifest;
    }

    // ================= الخطوة 3: المونتاج =================
    manifest.status = 'assembling';
    saveManifest(manifest);

    const { finalPath, voiceoverPath, totalDuration } = await assembleReel({
      scenes: manifest.scenes,
      outDir,
      title: manifest.title,
    });

    manifest.outputs = { final: finalPath, voiceover: voiceoverPath, durationSec: totalDuration };
    manifest.status = 'done';
    saveManifest(manifest);

    log.ok(`تم. الصرف الفعلي: ${log.money(manifest.spentUsd)}`);
    return manifest;
  } catch (err) {
    manifest.status = 'failed';
    manifest.errors.push({ at: new Date().toISOString(), message: err.message });
    saveManifest(manifest);
    throw err;
  }
}
