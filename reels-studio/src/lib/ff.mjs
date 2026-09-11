// أغلفة رفيعة حوالين ffmpeg/ffprobe
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function assertFfmpeg() {
  for (const bin of ['ffmpeg', 'ffprobe']) {
    try {
      await execFileAsync(bin, ['-version']);
    } catch {
      throw new Error(
        `"${bin}" مش متثبت أو مش في الـ PATH.\n` +
          'CentOS/RHEL 9:  dnf install -y epel-release && dnf install -y ffmpeg ffmpeg-devel\n' +
          '(لو مفيش حزمة: فعّل RPM Fusion، أو استخدم بناء ثابت من johnvansickle.com/ffmpeg)',
      );
    }
  }
}

export async function ffmpeg(args, { cwd } = {}) {
  try {
    // maxBuffer عالي لأن ffmpeg بيطبع لوجّات كتير على stderr
    return await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      cwd,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    const detail = (e.stderr || e.message || '').trim().split('\n').slice(-12).join('\n');
    throw new Error(`ffmpeg فشل:\n${detail}`);
  }
}

async function probe(file, args) {
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'error', ...args, '-of', 'default=noprint_wrappers=1:nokey=1', file],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  return stdout.trim();
}

/**
 * بيتأكد إن الخط المطلوب متثبت فعلاً.
 * fontconfig مابيفشلش لما الخط ناقص — بيرجّع بديل في صمت،
 * والنتيجة سَبتايتل عربي بحروف مقطّعة أو مربعات من غير أي رسالة خطأ.
 */
export async function fontStatus(family) {
  try {
    const { stdout } = await execFileAsync('fc-match', [family, 'family']);
    const matched = stdout.trim();
    return { available: matched.toLowerCase() === family.toLowerCase(), matched };
  } catch {
    return { available: false, matched: null, noFontconfig: true };
  }
}

export async function hasAudioStream(file) {
  const out = await probe(file, ['-select_streams', 'a', '-show_entries', 'stream=codec_type']);
  return out.length > 0;
}

export async function durationSeconds(file) {
  const out = await probe(file, ['-show_entries', 'format=duration']);
  const n = Number(out);
  return Number.isFinite(n) ? n : 0;
}
