import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from '../config.mjs';

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function exists(p) {
  return fs.existsSync(p);
}

/** ملف موجود وحجمه أكبر من صفر — الملفات الفاضية بتتولد لما عملية تتقطع في النص. */
export function hasContent(p) {
  try {
    return fs.statSync(p).size > 0;
  } catch {
    return false;
  }
}

export function readJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(p, data) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return p;
}

export function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\w؀-ۿ-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'reel';
}

export function reelDir(reelId) {
  return path.join(DIRS.out, reelId);
}

// ---------------------------------------------------------------
// المانيفست: حالة الريل على القرص. هو اللي بيخلي الفلو قابل للاستئناف —
// أي خطوة اتعملت قبل كده مش بتتعاد (ومفيش فلوس بتتصرف تاني).
// ---------------------------------------------------------------

export function manifestPath(reelId) {
  return path.join(reelDir(reelId), 'manifest.json');
}

export function loadManifest(reelId) {
  return readJson(manifestPath(reelId));
}

export function saveManifest(m) {
  m.updatedAt = new Date().toISOString();
  return writeJson(manifestPath(m.id), m);
}

export function newManifest({ id, character, scriptId, title }) {
  return {
    id,
    title: title || id,
    character,
    scriptId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'created',
    spentUsd: 0,
    scenes: [],
    outputs: {},
    errors: [],
  };
}
