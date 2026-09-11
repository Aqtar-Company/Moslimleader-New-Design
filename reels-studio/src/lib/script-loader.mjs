import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from '../config.mjs';
import { exists, readJson } from './fsx.mjs';

/**
 * بيقرا سكريبت من scripts/. بيقبل شكلين:
 *   <id>.json  -> { title, body, notes? }
 *   <id>.md    -> العنوان من أول سطر "# ...", والباقي هو الـ body
 */
export function loadScript(id) {
  const bare = id.replace(/\.(json|md|txt)$/i, '');

  const jsonPath = path.join(DIRS.scripts, `${bare}.json`);
  if (exists(jsonPath)) {
    const data = readJson(jsonPath);
    if (!data?.body) throw new Error(`السكريبت ${jsonPath} لازم يحتوي على حقل "body".`);
    return { id: bare, title: data.title || bare, body: data.body, notes: data.notes || '' };
  }

  for (const ext of ['.md', '.txt']) {
    const p = path.join(DIRS.scripts, `${bare}${ext}`);
    if (exists(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const lines = raw.split('\n');
      let title = bare;
      let body = raw;
      if (lines[0]?.startsWith('#')) {
        title = lines[0].replace(/^#+\s*/, '').trim();
        body = lines.slice(1).join('\n').trim();
      }
      if (!body.trim()) throw new Error(`السكريبت ${p} فاضي.`);
      return { id: bare, title, body, notes: '' };
    }
  }

  throw new Error(
    `السكريبت "${id}" مش موجود.\nدوّرت في: ${DIRS.scripts}\nالامتدادات المقبولة: .json .md .txt`,
  );
}

export function listScripts() {
  if (!exists(DIRS.scripts)) return [];
  return fs
    .readdirSync(DIRS.scripts)
    .filter((f) => /\.(json|md|txt)$/i.test(f))
    .map((f) => f.replace(/\.(json|md|txt)$/i, ''))
    .sort();
}
