#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, DIRS, planClips, estimateCostUsd, totalSeconds } from './config.mjs';
import { ensureDir, exists, readJson, writeJson, loadManifest, reelDir } from './lib/fsx.mjs';
import { listCharacters, loadCharacter } from './lib/character.mjs';
import { loadScript, listScripts } from './lib/script-loader.mjs';
import { assertFfmpeg, fontStatus } from './lib/ff.mjs';
import { produceReel } from './pipeline.mjs';
import { log } from './lib/log.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];

const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const HELP = `
reels-studio — خط إنتاج ريلز آلي

الاستخدام:
  node src/cli.mjs <أمر> [خيارات]

الأوامر:
  doctor                          فحص البيئة: المفاتيح، ffmpeg، الخطوط، الإعدادات
  new-character <slug>            إنشاء مجلد كاركتر جديد بقالب profile.json
  new-script <id>                 إنشاء ملف سكريبت جديد
  list                            عرض الكاركترات والسكريبتات والريلز

  make <character> <script>       إنتاج ريل واحد
      --dry-run                   يطبع برومبتات Veo من غير ما يصرف مليم
      --force                     يعيد كل الخطوات حتى الموجودة
      --resume <reelId>           يكمّل ريل وقف في النص

  enqueue <character> <script>    يضيف مهمة للطابور (للتشغيل المجدول)
  run-queue [--limit N]           ينفّذ مهام الطابور — ده اللي الـ cron بينده عليه
  status [reelId]                 حالة الريلز

أمثلة:
  node src/cli.mjs doctor
  node src/cli.mjs new-character ameen
  node src/cli.mjs make ameen intro-episode --dry-run
  node src/cli.mjs make ameen intro-episode
  node src/cli.mjs run-queue --limit 3
`;

// ═══════════════════════════════════════════════════════════════
async function doctor() {
  console.log('\n── فحص البيئة ──────────────────────────────\n');
  let problems = 0;

  const check = (label, ok, hint = '') => {
    console.log(`  ${ok ? '✓' : '✗'}  ${label}${!ok && hint ? `\n       └─ ${hint}` : ''}`);
    if (!ok) problems++;
  };

  check(
    'GEMINI_API_KEY',
    Boolean(CONFIG.geminiApiKey),
    'هاته من aistudio.google.com/apikey وفعّل الفوترة. اشتراك Flow مش بيدي وصول API.',
  );
  check('ANTHROPIC_API_KEY', Boolean(CONFIG.anthropicApiKey), 'مطلوب لتقسيم السكريبت لمشاهد.');

  try {
    await assertFfmpeg();
    check('ffmpeg + ffprobe', true);
  } catch (e) {
    check('ffmpeg + ffprobe', false, e.message.split('\n')[1] || '');
  }

  if (CONFIG.burnSubtitles) {
    const font = await fontStatus(CONFIG.subtitleFont);
    check(
      `الخط العربي "${CONFIG.subtitleFont}"`,
      font.available,
      font.noFontconfig
        ? 'fontconfig مش متثبت — مش قادر أتأكد من الخط.'
        : `fontconfig بيرجّع "${font.matched}" بدله. السَبتايتل هيطلع بحروف مقطّعة من غير أي رسالة خطأ.\n` +
          '       CentOS/RHEL:  dnf install -y google-noto-sans-arabic-fonts && fc-cache -f',
    );
  }

  const logoPath = path.join(DIRS.assets, CONFIG.outroLogo);
  check(
    `لوجو الخاتمة (${CONFIG.outroLogo})`,
    exists(logoPath),
    `حطّ اللوجو في ${logoPath} — من غيره الخاتمة هتبقى خلفية سادة.`,
  );

  if (CONFIG.music) {
    const m = path.isAbsolute(CONFIG.music) ? CONFIG.music : path.join(DIRS.assets, CONFIG.music);
    check(`ملف الموسيقى (${CONFIG.music})`, exists(m), `مش موجود في ${m}`);
  }

  const chars = listCharacters();
  check(`كاركترات (${chars.length})`, chars.length > 0, 'اعمل واحد: node src/cli.mjs new-character <slug>');

  for (const slug of chars) {
    try {
      const c = loadCharacter(slug);
      const n = c.refs.length;
      console.log(
        `       • ${slug}: ${n} صورة مرجعية ${n === 0 ? '⚠️  من غير صور الوجه هيتغير كل ريل' : ''}`,
      );
    } catch (e) {
      console.log(`       • ${slug}: ✗ ${e.message.split('\n')[0]}`);
      problems++;
    }
  }

  console.log('\n── الإعدادات الحالية ───────────────────────\n');
  const clips = planClips();
  const billed = clips.reduce((s, c) => s + c.requestSeconds, 0);
  console.log(`  المستوى         ${CONFIG.tier}  (${CONFIG.veoModel})`);
  console.log(`  الدقة           ${CONFIG.resolution} — ${CONFIG.aspectRatio}`);
  console.log(
    `  جزء AI          ${CONFIG.videoSeconds}ث  =  ${clips.length} كليب ` +
      `(${clips.map((c) => `${c.useSeconds}ث`).join(' + ')})`,
  );
  console.log(`  الخاتمة         ${CONFIG.outroSeconds}ث (كارت لوجو محلي، $0.00)`);
  console.log(`  الإجمالي        ${totalSeconds()}ث`);
  console.log(`  الصوت           ${CONFIG.audioMode === 'veo' ? 'Veo يولّده' : 'صامت + نص VO'}`);
  console.log(`  سبتايتل محروق   ${CONFIG.burnSubtitles ? 'نعم' : 'لا'}`);
  console.log(`\n  التكلفة/ريل     $${estimateCostUsd(clips).toFixed(2)}  (${billed}ث مدفوعة من Veo)`);
  console.log(`  سقف الأمان      $${CONFIG.maxCostUsd.toFixed(2)}/ريل\n`);

  if (problems > 0) {
    console.log(`⚠️  ${problems} مشكلة محتاجة حل قبل التشغيل.\n`);
    process.exitCode = 1;
  } else {
    console.log('✅ كل حاجة تمام — جاهز للإنتاج.\n');
  }
}

// ═══════════════════════════════════════════════════════════════
function newCharacter(slug) {
  if (!slug) throw new Error('محتاج اسم للكاركتر: node src/cli.mjs new-character <slug>');
  const dir = path.join(DIRS.characters, slug);
  if (exists(path.join(dir, 'profile.json'))) throw new Error(`الكاركتر "${slug}" موجود بالفعل في ${dir}`);

  ensureDir(path.join(dir, 'refs'));
  writeJson(path.join(dir, 'profile.json'), {
    name: slug,
    appearance:
      'A woman in her early thirties, warm brown eyes, olive skin, defined eyebrows, calm confident expression',
    wardrobe: 'A navy hijab and a cream long-sleeve blouse, simple and modest',
    voice: 'Warm, measured, mid-range; speaks Modern Standard Arabic',
    styleNotes: 'Soft natural window light, shallow depth of field, warm neutral color grade, cinematic',
    setting: 'A minimal modern room with a bookshelf softly blurred in the background',
    negative: '',
  });

  console.log(`
✅ اتعمل الكاركتر: ${dir}

الخطوة الجاية — دي الأهم:
  1. عدّل  ${path.join(dir, 'profile.json')}
     (الوصف بالإنجليزي — موديلات الفيديو بتفهمه أدق)

  2. حطّ من 1 لـ 3 صور للشخصية في:
       ${path.join(dir, 'refs')}/

     ⚠️  من غير الصور دي، كل ريل هيطلع بوش مختلف مهما كان الوصف دقيق.
     الصور دي هي اللي بتثبّت الشخصية، مش النص.

     مواصفات الصور: وجه واضح، إضاءة كويسة، خلفية بسيطة،
     زوايا مختلفة (أمامي / ثلاثة أرباع / نص جسم).
`);
}

function newScript(id) {
  if (!id) throw new Error('محتاج اسم للسكريبت: node src/cli.mjs new-script <id>');
  ensureDir(DIRS.scripts);
  const p = path.join(DIRS.scripts, `${id}.md`);
  if (exists(p)) throw new Error(`السكريبت موجود بالفعل: ${p}`);

  fs.writeFileSync(
    p,
    `# عنوان الريل

اكتب السكريبت بالعربي هنا — كلام عادي، مش محتاج تقسّمه لمشاهد.
الفلو هو اللي هيقسّمه ويكتب برومبتات الفيديو.

خلّيه في حدود ${Math.round(CONFIG.videoSeconds * 2.5)} كلمة عشان ينطق في ${CONFIG.videoSeconds} ثانية.
ابدأ بأقوى جملة — أول ثانيتين هما اللي بيوقفوا الإصبع.
`,
    'utf8',
  );
  console.log(`✅ اتعمل السكريبت: ${p}\nعدّله وبعدين: node src/cli.mjs make <character> ${id}`);
}

// ═══════════════════════════════════════════════════════════════
function list() {
  const chars = listCharacters();
  const scripts = listScripts();
  const reels = exists(DIRS.out)
    ? fs.readdirSync(DIRS.out, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];

  console.log('\nالكاركترات:');
  if (!chars.length) console.log('  (مفيش)');
  for (const c of chars) {
    const ch = loadCharacter(c);
    console.log(`  • ${c}  — ${ch.refs.length} صورة مرجعية`);
  }

  console.log('\nالسكريبتات:');
  if (!scripts.length) console.log('  (مفيش)');
  for (const s of scripts) console.log(`  • ${s}`);

  console.log('\nالريلز:');
  if (!reels.length) console.log('  (مفيش)');
  for (const r of reels.sort().reverse()) {
    const m = loadManifest(r);
    console.log(`  • ${r}  [${m?.status || '?'}]  $${(m?.spentUsd || 0).toFixed(2)}`);
  }
  console.log('');
}

function status(reelId) {
  if (!reelId) return list();
  const m = loadManifest(reelId);
  if (!m) throw new Error(`مفيش ريل بالاسم ده: ${reelId}`);
  console.log(JSON.stringify(m, null, 2));
}

// ═══════════════════════════════════════════════════════════════
function enqueue(characterSlug, scriptId) {
  if (!characterSlug || !scriptId) throw new Error('الاستخدام: enqueue <character> <script>');
  loadCharacter(characterSlug); // بيتحقق إنه موجود قبل ما يتحط في الطابور
  loadScript(scriptId);

  ensureDir(DIRS.queue);
  const jobId = `${Date.now()}-${characterSlug}-${scriptId}`;
  const p = path.join(DIRS.queue, `${jobId}.json`);
  writeJson(p, { jobId, characterSlug, scriptId, queuedAt: new Date().toISOString(), status: 'pending' });
  console.log(`✅ اتضافت للطابور: ${jobId}`);
}

async function runQueue() {
  const limit = Number(opt('limit', '1')) || 1;
  ensureDir(DIRS.queue);

  const jobs = fs
    .readdirSync(DIRS.queue)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: path.join(DIRS.queue, f), data: readJson(path.join(DIRS.queue, f)) }))
    .filter((j) => j.data?.status === 'pending')
    .slice(0, limit);

  if (!jobs.length) {
    log.info('الطابور فاضي — مفيش مهام معلّقة.');
    return;
  }

  log.info(`تنفيذ ${jobs.length} مهمة من الطابور...`);
  let failures = 0;

  for (const job of jobs) {
    try {
      const script = loadScript(job.data.scriptId);
      const manifest = await produceReel({ characterSlug: job.data.characterSlug, script });
      writeJson(job.file, {
        ...job.data,
        status: 'done',
        reelId: manifest.id,
        finishedAt: new Date().toISOString(),
        spentUsd: manifest.spentUsd,
      });
    } catch (e) {
      failures++;
      log.err(`المهمة ${job.data.jobId} فشلت: ${e.message}`);
      // بتتسجّل failed مش بتترجع pending — عشان الـ cron ما يفضلش يكررها ويحرق فلوس
      writeJson(job.file, {
        ...job.data,
        status: 'failed',
        error: e.message,
        failedAt: new Date().toISOString(),
      });
    }
  }

  if (failures) process.exitCode = 1;
}

// ═══════════════════════════════════════════════════════════════
async function make() {
  const characterSlug = argv[1];
  const scriptId = argv[2];
  if (!characterSlug || !scriptId) throw new Error('الاستخدام: make <character> <script> [--dry-run] [--force]');

  const script = loadScript(scriptId);
  await produceReel({
    characterSlug,
    script,
    dryRun: flag('dry-run'),
    force: flag('force'),
    reelId: opt('resume'),
  });
}

// ═══════════════════════════════════════════════════════════════
try {
  switch (cmd) {
    case 'doctor': await doctor(); break;
    case 'new-character': newCharacter(argv[1]); break;
    case 'new-script': newScript(argv[1]); break;
    case 'list': list(); break;
    case 'status': status(argv[1]); break;
    case 'make': await make(); break;
    case 'enqueue': enqueue(argv[1], argv[2]); break;
    case 'run-queue': await runQueue(); break;
    case undefined:
    case '--help':
    case '-h':
    case 'help': console.log(HELP); break;
    default:
      console.log(HELP);
      throw new Error(`أمر غير معروف: ${cmd}`);
  }
} catch (err) {
  log.err(err.message);
  process.exit(1);
}
