#!/usr/bin/env bash
# أين نجد تسجيلًا بعينه للحصري — يُشغَّل على السيرفر.
#
#   cd /home/moslimleader.com/app && bash ops/find-husary.sh
#
# يسأل mp3quran.net عن كل مصاحف الحصري المنشورة، ويطبع لكل مصحفٍ اسمَه
# ورابطَ سورةٍ منه لتسمعها. الغرضُ أن تُعرَف النسخةُ بالسماع، ثم نرى بعدها
# كيف نُدخلها في المشغّل.
#
# لماذا mp3quran وليس everyayah: الأخيرُ يوزّع ملفًا لكل آية — وهو ما يحتاجه
# مشغّلُنا — لكنه لا يحمل إلا نسخًا قليلة. وmp3quran يحمل المصاحف كاملةً
# بأسمائها، فهو الأصلحُ للتعرّف. وإن كانت النسخةُ المطلوبة عنده وحده، فهي
# ملفٌ لكل سورة لا لكل آية، وذلك تحوّلٌ في المشغّل — انظر آخر المخرجات.

set -u

echo "═══ مصاحف الحصري المنشورة على mp3quran.net ═══"
echo

node - <<'EOF'
const https = require('https');

// mp3quran يُعيد التوجيه (www، ونسخةُ الـAPI)، و https.get لا يتبع التوجيه من
// تلقائه — فيعود بصفحة HTML تُفسَّر على أنها JSON فاسد. وهذا بعينه ما حدث.
function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('too many redirects'));
    const req = https.get(url, {
      timeout: 30000,
      headers: { 'User-Agent': 'curl/8', 'Accept': 'application/json' },
    }, res => {
      const loc = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
        res.resume();
        return resolve(get(new URL(loc, url).href, depth + 1));
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// العناوينُ تتبدّل بين إصدارات الموقع؛ نجرّبها بالترتيب ونقف عند أولِ JSON صالح.
const ENDPOINTS = [
  'https://mp3quran.net/api/v3/reciters?language=ar',
  'https://www.mp3quran.net/api/v3/reciters?language=ar',
  'https://mp3quran.net/api/v3/reciters?language=eng',
  'https://api.mp3quran.net/api/v3/reciters?language=ar',
  'https://mp3quran.net/api/_arabic.json',
];

(async () => {
  let list = null;
  for (const url of ENDPOINTS) {
    let r;
    try { r = await get(url); }
    catch (e) { console.log(`  ·  ${url}\n     تعذّر: ${e.message}`); continue; }
    let data;
    try { data = JSON.parse(r.body); }
    catch {
      // نطبع أولَ ما عاد به الخادم: بغيره يبقى العطلُ مجهولًا.
      console.log(`  ·  ${url}\n     ${r.status} ${r.type} — ليس JSON: ${r.body.slice(0, 120).replace(/\s+/g, ' ')}`);
      continue;
    }
    const arr = data.reciters || data.reciter || (Array.isArray(data) ? data : null);
    if (arr && arr.length) { console.log(`  ✅ المصدر: ${url}\n`); list = arr; break; }
    console.log(`  ·  ${url}\n     JSON بلا قائمة قرّاء (مفاتيحه: ${Object.keys(data).join(', ')})`);
  }

  if (!list) {
    console.log();
    console.log('  لم يُجب أيُّ عنوان بقائمةٍ صالحة. جرّب باليد وانظر ماذا يعود:');
    console.log('    curl -sL -A curl/8 "https://mp3quran.net/api/v3/reciters?language=ar" | head -c 300');
    return;
  }

  const hits = list.filter(r => /حصر|حصري|Husary|Hussary|Husari/i.test(r.name || ''));
  if (!hits.length) {
    console.log(`  لم يُعثر على الحصري بين ${list.length} قارئًا.`);
    return;
  }
  for (const r of hits) {
    console.log(`  ── ${r.name}  (id ${r.id})`);
    for (const m of r.moshaf || []) {
      const first = String(m.surah_list || '').split(',')[0] || '1';
      const n = String(first).padStart(3, '0');
      console.log(`     • ${m.name}`);
      console.log(`       عدد السور: ${m.surah_total}   |   اسمعها: ${m.server}${n}.mp3`);
    }
    console.log();
  }
  console.log('  ملاحظة: هذه ملفاتُ سورٍ كاملة، لا ملفَ لكل آية.');
})();
EOF

echo
echo "═══ ماذا بعد أن تعرف النسخة ═══"
echo "  ١) إن وُجدت على everyayah بملفٍ لكل آية → سطرٌ واحدٌ في quran-reciters.ts."
echo "  ٢) إن كانت ملفَ سورةٍ كاملة فقط → إمّا أن نُشغّل السورة كاملةً بلا تظليل"
echo "     آية، وإمّا أن تُحاذى كما حوذيت تلاوةُ د. إبراهيم (عملٌ كبير)."
echo "  ٣) وفي الحالتين: تأكّد أن لك حقَّ استضافتها أو الوصلِ إليها قبل النشر."
