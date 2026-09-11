// الخطوة 3: كليبات + خاتمة -> ريل واحد جاهز للنشر
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, DIRS } from '../config.mjs';
import { ensureDir, exists } from '../lib/fsx.mjs';
import { ffmpeg, hasAudioStream, assertFfmpeg } from '../lib/ff.mjs';
import { log } from '../lib/log.mjs';

const { outputWidth: W, outputHeight: H, fps: FPS } = CONFIG;

// كل المقاطع بتتوحّد على نفس الترميز عشان الدمج يعدّي من غير مشاكل
const VIDEO_ENCODE = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const AUDIO_ENCODE = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];

const SCALE_CROP = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},format=yuv420p`;

// ---------------------------------------------------------------
// 1) توحيد كل كليب: قص للمدة المطلوبة + مقاس عمودي + ضمان وجود تراك صوت
// ---------------------------------------------------------------
async function normalizeClip(srcPath, destPath, seconds) {
  const withAudio = await hasAudioStream(srcPath);

  const args = withAudio
    ? ['-i', srcPath, '-t', String(seconds), '-vf', SCALE_CROP, ...VIDEO_ENCODE, ...AUDIO_ENCODE, destPath]
    : [
        '-i',
        srcPath,
        // الكليبات الصامتة بتاخد تراك سكوت — من غيره الدمج بيقع
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=48000:cl=stereo',
        '-t',
        String(seconds),
        '-vf',
        SCALE_CROP,
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        ...VIDEO_ENCODE,
        ...AUDIO_ENCODE,
        destPath,
      ];

  await ffmpeg(args);
  return destPath;
}

// ---------------------------------------------------------------
// 2) كارت الخاتمة: اللوجو على خلفية ثابتة. بيتعمل محلياً — تكلفته صفر.
// ---------------------------------------------------------------
async function buildOutro(destPath, seconds) {
  const logoPath = path.join(DIRS.assets, CONFIG.outroLogo);
  const hasLogo = exists(logoPath);

  if (!hasLogo) {
    log.warn(`اللوجو مش موجود في ${logoPath} — الخاتمة هتبقى خلفية سادة.`);
  }

  const bg = `color=c=${CONFIG.outroBg}:s=${W}x${H}:d=${seconds},fps=${FPS}`;

  // اللوجو بيتحط جوه صندوق (65% عرض × 18% ارتفاع) مع الحفاظ على النسبة.
  // تحديد الارتفاع لوحده بيخلي أي لوجو عريض يخرج برّه الشاشة.
  const boxW = Math.round(W * 0.65);
  const boxH = Math.round(H * 0.18);
  const logoScale = `scale=${boxW}:${boxH}:force_original_aspect_ratio=decrease`;

  // زووم بطيء جداً بدل السكون التام — بيمنع إحساس إن الفيديو وقف
  const zoomStep = CONFIG.outroZoom;
  const totalFrames = Math.max(1, Math.round(seconds * FPS));
  const zoomFilter =
    zoomStep > 0
      ? `,zoompan=z='1+${zoomStep}*on/${totalFrames}':d=1:s=${W}x${H}:fps=${FPS}`
      : '';

  const buildArgs = (withZoom) => {
    const zf = withZoom ? zoomFilter : '';
    if (hasLogo) {
      return [
        '-loop', '1', '-i', logoPath,
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
        '-f', 'lavfi', '-i', bg,
        '-filter_complex',
        `[0:v]${logoScale}[lg];[2:v][lg]overlay=(W-w)/2:(H-h)/2:format=auto,format=yuv420p${zf}[v]`,
        '-map', '[v]', '-map', '1:a:0',
        '-t', String(seconds),
        ...VIDEO_ENCODE, ...AUDIO_ENCODE, destPath,
      ];
    }
    return [
      '-f', 'lavfi', '-i', bg,
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-t', String(seconds),
      '-vf', `format=yuv420p${zf.replace(/^,/, ',')}`,
      '-map', '0:v:0', '-map', '1:a:0',
      ...VIDEO_ENCODE, ...AUDIO_ENCODE, destPath,
    ];
  };

  try {
    await ffmpeg(buildArgs(zoomStep > 0));
  } catch (e) {
    if (zoomStep <= 0) throw e;
    // zoompan بيختلف بين إصدارات ffmpeg — لو فشل، كارت ثابت أحسن من فشل الريل كله
    log.warn('فلتر الزووم فشل على نسخة ffmpeg دي — بنعمل الخاتمة ثابتة.');
    await ffmpeg(buildArgs(false));
  }

  return destPath;
}

// ---------------------------------------------------------------
// 3) ملف السَبتايتل — libass هو اللي بيعالج تشكيل وترتيب العربي صح
// ---------------------------------------------------------------
function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const f = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${f}`;
}

/** بيحوّل المشاهد لسطور توقيت — المصدر الوحيد لكل من ASS و SRT. */
export function subtitleEntries(scenes, { outroText = '', outroStart = 0, outroSeconds = 0 } = {}) {
  const entries = [];
  let cursor = 0;

  for (const scene of scenes) {
    const text = scene.onScreenText || scene.arabicLine;
    if (text) {
      entries.push({ start: cursor, end: cursor + scene.durationSec, text });
    }
    cursor += scene.durationSec;
  }

  if (outroText && outroSeconds > 0) {
    entries.push({ start: outroStart, end: outroStart + outroSeconds, text: outroText });
  }

  return entries;
}

/** SRT للرفع على انستجرام/يوتيوب كملف ترجمة منفصل (مش للحرق). */
export function buildSrt(entries) {
  return entries
    .map((e, i) => `${i + 1}\n${srtTime(e.start)} --> ${srtTime(e.end)}\n${e.text}\n`)
    .join('\n');
}

function assTime(seconds) {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = String(Math.floor((cs % 360000) / 6000)).padStart(2, '0');
  const s = String(Math.floor((cs % 6000) / 100)).padStart(2, '0');
  const c = String(cs % 100).padStart(2, '0');
  return `${h}:${m}:${s}.${c}`;
}

/**
 * بنولّد ملف ASS بنفسنا بدل ما نسيب ffmpeg يحوّل الـ SRT.
 *
 * السبب: التحويل التلقائي بيفترض دقة مرجعية 384×288، فأي قيمة بكسل
 * (حجم الخط، الهامش السفلي) بتتفسّر في مقياس تاني — والنتيجة سَبتايتل
 * ضخم في أعلى الشاشة بدل ما يكون تحت. تحديد PlayResX/Y صراحةً
 * بيخلي كل القيم بالبكسل الحقيقي للفيديو.
 */
export function buildAss(entries) {
  // 4.2% من ارتفاع الفيديو — الحجم اللي بيتقرا على شاشة موبايل صغيرة
  const fontSize = Math.round(H * 0.042);
  const marginV = Math.round(H * 0.1);
  const marginSide = Math.round(W * 0.08);
  const outline = Math.max(2, Math.round(H * 0.0022));

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,' +
      ' Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline,' +
      ' Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Alignment=2 أسفل الوسط | Encoding=178 محرف عربي
    `Style: Default,${CONFIG.subtitleFont},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,` +
      `1,0,0,0,100,100,0,0,1,${outline},2,2,${marginSide},${marginSide},${marginV},178`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events = entries.map((e) => {
    // { } في ASS بتبدأ أكواد تنسيق — بنشيلها عشان النص ما يختفيش
    const text = e.text.replace(/[{}]/g, '').replace(/\r?\n/g, '\\N').trim();
    return `Dialogue: 0,${assTime(e.start)},${assTime(e.end)},Default,,0,0,0,,${text}`;
  });

  return [...header, ...events].join('\n') + '\n';
}

// ---------------------------------------------------------------
// 4) الدمج النهائي + الموسيقى المتصلة + السَبتايتل
// ---------------------------------------------------------------
export async function assembleReel({ scenes, outDir, title }) {
  await assertFfmpeg();

  const workDir = ensureDir(path.join(outDir, 'work'));
  const clipsDir = path.join(outDir, 'clips');

  // --- توحيد الكليبات ---
  log.step('توحيد الكليبات (قص + مقاس 9:16)...');
  const normalized = [];
  for (const scene of scenes) {
    const src = path.join(clipsDir, `scene-${String(scene.index).padStart(2, '0')}.mp4`);
    if (!exists(src)) throw new Error(`الكليب ناقص: ${src} — شغّل خطوة التوليد الأول.`);
    const dest = path.join(workDir, `norm-${String(scene.index).padStart(2, '0')}.mp4`);
    await normalizeClip(src, dest, scene.durationSec);
    normalized.push(dest);
  }

  // --- الخاتمة ---
  let outroPath = null;
  if (CONFIG.outroSeconds > 0) {
    log.step(`بناء كارت الخاتمة (${CONFIG.outroSeconds}ث، تكلفة صفر)...`);
    outroPath = path.join(workDir, 'outro.mp4');
    await buildOutro(outroPath, CONFIG.outroSeconds);
    normalized.push(outroPath);
  }

  // --- الدمج ---
  const listFile = path.join(workDir, 'concat.txt');
  fs.writeFileSync(listFile, normalized.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');

  const stitched = path.join(workDir, 'stitched.mp4');
  log.step('دمج المقاطع...');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', stitched]);

  const videoSeconds = scenes.reduce((sum, s) => sum + s.durationSec, 0);
  const totalDuration = videoSeconds + CONFIG.outroSeconds;

  // --- السَبتايتل ---
  const entries = subtitleEntries(scenes, {
    outroText: CONFIG.outroText,
    outroStart: videoSeconds,
    outroSeconds: CONFIG.outroSeconds,
  });

  // SRT منفصل دايماً — بيتستخدم كملف ترجمة عند الرفع
  if (entries.length) {
    fs.writeFileSync(path.join(outDir, 'subtitles.srt'), buildSrt(entries), 'utf8');
  }

  // اسم نسبي + cwd على مجلد الشغل: بيتجنب جحيم الـ escaping في مسارات فلاتر ffmpeg
  let subtitleFilter = '';
  if (CONFIG.burnSubtitles && entries.length) {
    fs.writeFileSync(path.join(workDir, 'subs.ass'), buildAss(entries), 'utf8');
    subtitleFilter = 'subtitles=subs.ass';
  }

  // --- الموسيقى: تراك واحد متصل على الريل كله، الخاتمة كمان ---
  const finalPath = path.join(outDir, 'final.mp4');
  const musicPath = CONFIG.music
    ? path.isAbsolute(CONFIG.music)
      ? CONFIG.music
      : path.join(DIRS.assets, CONFIG.music)
    : '';
  const useMusic = Boolean(musicPath && exists(musicPath));

  if (CONFIG.music && !useMusic) {
    log.warn(`ملف الموسيقى مش موجود: ${musicPath} — هنكمل من غير موسيقى.`);
  }

  const fadeStart = Math.max(0, totalDuration - CONFIG.audioFadeOutSeconds);

  // ترتيب الوسائط مهم: خيارات الدخل بتتطبق على الـ -i اللي بعدها مباشرة.
  // -stream_loop لازم يسبق ملف الموسيقى تحديداً — لو سبق الفيديو، الموسيقى
  // بتقف عند نهايتها والخاتمة بتيجي في سكوت.
  const args = ['-i', stitched];
  if (useMusic) {
    args.push('-stream_loop', '-1', '-i', musicPath);
  }

  const vChain = subtitleFilter ? `[0:v]${subtitleFilter}[v]` : `[0:v]null[v]`;

  const aChain = useMusic
    ? `[1:a]volume=${CONFIG.musicVolume},atrim=0:${totalDuration},asetpts=PTS-STARTPTS[m];` +
      `[0:a][m]amix=inputs=2:duration=first:normalize=0[mixed];` +
      `[mixed]afade=t=out:st=${fadeStart}:d=${CONFIG.audioFadeOutSeconds}[a]`
    : `[0:a]afade=t=out:st=${fadeStart}:d=${CONFIG.audioFadeOutSeconds}[a]`;

  log.step('الإخراج النهائي...');
  await ffmpeg(
    [
      ...args,
      '-filter_complex',
      `${vChain};${aChain}`,
      '-map', '[v]',
      '-map', '[a]',
      '-t', String(totalDuration),
      ...VIDEO_ENCODE,
      ...AUDIO_ENCODE,
      '-movflags', '+faststart',
      finalPath,
    ],
    { cwd: workDir },
  );

  // نص التعليق الصوتي — بيفيد لو هتسجّل voice-over بشري أو تستخدم TTS خارجي
  const voiceoverPath = path.join(outDir, 'voiceover.txt');
  fs.writeFileSync(
    voiceoverPath,
    [`# ${title}`, '', ...scenes.map((s) => `[مشهد ${s.index} — ${s.durationSec}ث]\n${s.arabicLine}\n`)].join('\n'),
    'utf8',
  );

  // الملفات الوسيطة (كليبات موحّدة + المدموج + الخاتمة) نص حجم المجلد تقريباً
  // ومالهاش لازمة بعد النجاح. بتفضل موجودة لو الإخراج فشل عشان التشخيص.
  if (!CONFIG.keepWork) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  log.ok(`الريل جاهز: ${finalPath} (${totalDuration}ث)`);
  return { finalPath, voiceoverPath, totalDuration };
}
