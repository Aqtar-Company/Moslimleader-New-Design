import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from '../config.mjs';
import { readJson, exists } from './fsx.mjs';

const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// Veo بياخد 3 صور مرجعية كحد أقصى للشخصية الواحدة.
export const MAX_REFERENCE_IMAGES = 3;

/**
 * بيقرا كاركتر من characters/<slug>/
 *   profile.json  — الوصف الثابت
 *   refs/*.png    — الصور المرجعية (1-3) اللي بتثبّت الوجه
 */
export function loadCharacter(slug) {
  const dir = path.join(DIRS.characters, slug);
  const profileFile = path.join(dir, 'profile.json');

  if (!exists(profileFile)) {
    throw new Error(
      `الكاركتر "${slug}" مش موجود.\n` +
        `المتوقع: ${profileFile}\n` +
        `اعمله بالأمر: node src/cli.mjs new-character ${slug}`,
    );
  }

  const profile = readJson(profileFile);
  if (!profile) throw new Error(`ملف الكاركتر تالف أو مش JSON صحيح: ${profileFile}`);

  for (const field of ['name', 'appearance']) {
    if (!profile[field]) {
      throw new Error(`الكاركتر "${slug}" ناقصه الحقل الإلزامي "${field}" في profile.json`);
    }
  }

  const refsDir = path.join(dir, 'refs');
  let refs = [];
  if (exists(refsDir)) {
    refs = fs
      .readdirSync(refsDir)
      .filter((f) => IMAGE_MIME[path.extname(f).toLowerCase()])
      .sort()
      .slice(0, MAX_REFERENCE_IMAGES)
      .map((f) => {
        const full = path.join(refsDir, f);
        return {
          file: full,
          mimeType: IMAGE_MIME[path.extname(f).toLowerCase()],
          base64: fs.readFileSync(full).toString('base64'),
        };
      });
  }

  return { slug, dir, profile, refs };
}

export function listCharacters() {
  if (!exists(DIRS.characters)) return [];
  return fs
    .readdirSync(DIRS.characters, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => exists(path.join(DIRS.characters, name, 'profile.json')));
}

/**
 * "بلوك الكاركتر" — نص إنجليزي ثابت بيتلزق في *كل* برومبت مشهد.
 * ده نص التثبيت: نفس الكلمات بالحرف في كل ريل = نفس الشخصية.
 * أي تعديل هنا بيغيّر شكل الشخصية في كل الريلز الجاية، فعدّله بحذر.
 */
export function characterBlock(character) {
  const p = character.profile;
  const lines = [`CHARACTER (must stay identical in every shot): ${p.name}.`, `Appearance: ${p.appearance}.`];

  if (p.wardrobe) lines.push(`Wardrobe: ${p.wardrobe}.`);
  if (p.voice) lines.push(`Voice: ${p.voice}.`);
  if (p.styleNotes) lines.push(`Visual style: ${p.styleNotes}.`);
  if (p.setting) lines.push(`Setting: ${p.setting}.`);

  return lines.join(' ');
}

/** البرومبت السلبي — اللي مش عايزينه يظهر. بيتدمج مع أي negative خاص بالمشهد. */
export function negativePrompt(character, extra = '') {
  const base = [
    'text overlays, watermarks, logos, captions burned into frame',
    'distorted face, changing facial features, inconsistent clothing',
    'extra fingers, deformed hands',
    'low quality, blurry, jitter, flicker',
  ];
  const fromProfile = character.profile.negative ? [character.profile.negative] : [];
  const fromScene = extra ? [extra] : [];
  return [...base, ...fromProfile, ...fromScene].join(', ');
}
