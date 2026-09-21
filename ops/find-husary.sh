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

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  try {
    const raw = await get('https://mp3quran.net/api/v3/reciters?language=ar');
    const data = JSON.parse(raw);
    const list = data.reciters || [];
    // الحصري يُكتب بصورٍ شتّى — نطابق الجذر لا الاسم كاملًا.
    const hits = list.filter(r => /حصر|حصري|الحصري/.test(r.name || ''));
    if (!hits.length) {
      console.log('  لم يُعثر على الحصري في القائمة (قد تكون بنية الـAPI تغيّرت).');
      return;
    }
    for (const r of hits) {
      console.log(`  ── ${r.name}  (id ${r.id})`);
      for (const m of r.moshaf || []) {
        // كل مصحفٍ له خادمُه وقائمةُ سورِه؛ الملفات باسم السورة في ثلاثة أرقام.
        const first = String(m.surah_list || '').split(',')[0] || '1';
        const n = String(first).padStart(3, '0');
        console.log(`     • ${m.name}`);
        console.log(`       عدد السور: ${m.surah_total}   |   اسمعها: ${m.server}${n}.mp3`);
      }
      console.log();
    }
    console.log('  ملاحظة: هذه ملفاتُ سورٍ كاملة، لا ملفَ لكل آية.');
  } catch (e) {
    console.error('  تعذّر جلب القائمة:', e.message);
  }
})();
EOF

echo
echo "═══ ماذا بعد أن تعرف النسخة ═══"
echo "  ١) إن وُجدت على everyayah بملفٍ لكل آية → سطرٌ واحدٌ في quran-reciters.ts."
echo "  ٢) إن كانت ملفَ سورةٍ كاملة فقط → إمّا أن نُشغّل السورة كاملةً بلا تظليل"
echo "     آية، وإمّا أن تُحاذى كما حوذيت تلاوةُ د. إبراهيم (عملٌ كبير)."
echo "  ٣) وفي الحالتين: تأكّد أن لك حقَّ استضافتها أو الوصلِ إليها قبل النشر."
