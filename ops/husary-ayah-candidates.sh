#!/usr/bin/env bash
# كل تلاوات الحصري الموزَّعة بملفٍ لكل آية — للسماع والاختيار.
#
#   cd /home/moslimleader.com/app && bash ops/husary-ayah-candidates.sh
#
# لماذا هذا بدل التخمين: اسمُ المجلد لا يقول أيَّ تسجيلٍ بداخله. «الإذاعة
# المصرية» وصفٌ يُعرف بالأذن لا بالإملاء، وقد ضاع وقتٌ في تخمين أسماء.
# فالسكربت يجمع المرشَّحين من المصادر الثلاثة التي توزّع آيةً آية، ويتحقق
# أن كلَّ رابطٍ يُجيب فعلًا، ويطبعه لتفتحه وتسمعه.
#
# الآيةُ المختارة للمقارنة: الفاتحة ١ (قصيرة، تُعرف بها البصمةُ بسرعة)
# والبقرة ٢٥٥ (طويلة، يبين فيها المدُّ والنفَس).

set -u

probe() { curl -s -o /dev/null -w '%{http_code}' --max-time 25 -r 0-200 "$1" 2>/dev/null; }
ok() { [ "$1" = "200" ] || [ "$1" = "206" ]; }

N=0
show() { # اسمٌ، رابطُ الفاتحة، رابطُ البقرة
  c=$(probe "$2")
  if ok "$c"; then
    N=$((N+1))
    printf '\n  [%d] %s\n' "$N" "$1"
    printf '      الفاتحة ١ : %s\n' "$2"
    printf '      البقرة ٢٥٥: %s\n' "$3"
    [ "$4" = "now" ] && printf '      ← هذه هي المستعمَلة في التطبيق حاليًا (رفضتَها)\n'
  else
    printf '  ·   %-44s (لا يُجيب: %s)\n' "$1" "$c"
  fi
}

echo "═══ نسخ الحصري الموزَّعة بملفٍ لكل آية ═══"

EA="https://everyayah.com/data"
for d in Husary_128kbps Husary_64kbps Husary_Muallim_128kbps Husary_Mujawwad_128kbps Husary_Mujawwad_64kbps; do
  flag=no; [ "$d" = "Husary_128kbps" ] && flag=now
  show "everyayah / $d" "$EA/$d/001001.mp3" "$EA/$d/002255.mp3" "$flag"
done

# quran.com يوزّع تلاواتِه آيةً آية على verses.quran.com، وهو المصدرُ الذي
# تبني عليه تطبيقاتٌ كثيرة — فإن كانت النسخةُ المشهورة في التطبيقات، فهي هنا.
QV="https://verses.quran.com"
for d in Husary Husary_Muallim Husary_Mujawwad; do
  show "quran.com / $d" "$QV/$d/mp3/001001.mp3" "$QV/$d/mp3/002255.mp3" no
done

CDN="https://cdn.islamic.network/quran/audio"
for b in 128 64; do
  show "islamic.network / ar.husary ($b)" "$CDN/$b/ar.husary/1.mp3" "$CDN/$b/ar.husary/262.mp3" no
done

echo
echo "═══ ما تعلنه quran.com نفسها عن تلاوات الحصري ═══"
node - <<'EOF'
const https = require('https');
function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('too many redirects'));
    const req = https.get(url, { timeout: 25000, headers: { 'User-Agent': 'curl/8', Accept: 'application/json' } }, res => {
      const loc = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && loc) { res.resume(); return resolve(get(new URL(loc, url).href, depth + 1)); }
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(b));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}
(async () => {
  try {
    const data = JSON.parse(await get('https://api.quran.com/api/v4/resources/recitations?language=ar'));
    const all = data.recitations || [];
    const hits = all.filter(r => /husary|حصري|حصر/i.test(`${r.reciter_name || ''} ${r.translated_name?.name || ''}`));
    if (!hits.length) return console.log(`  لا حصريَّ بين ${all.length} تلاوة.`);
    for (const r of hits) {
      const label = r.translated_name?.name || r.reciter_name;
      console.log(`  ── id ${r.id}: ${label}${r.style ? '  (' + r.style + ')' : ''}`);
      // الرابطُ الحقيقيُّ لآيةٍ بعينها، كما يعطيه الموقعُ لتطبيقاته.
      try {
        const one = JSON.parse(await get(`https://api.quran.com/api/v4/recitations/${r.id}/by_ayah/2:255`));
        const f = (one.audio_files || [])[0];
        if (f) console.log(`     البقرة ٢٥٥: https://verses.quran.com/${String(f.url).replace(/^\//, '')}`);
      } catch (e) { console.log('     (تعذّر جلب رابط الآية:', e.message + ')'); }
    }
  } catch (e) { console.log('  تعذّر سؤال quran.com:', e.message); }
})();
EOF

echo
echo "افتح الروابط واسمعها، وقل لي رقمَ [n] أو سطرَ quran.com الذي هو تسجيلُ الإذاعة."
echo "وإن تشابهت عليك: البقرة ٢٥٥ أوضحُ في التمييز من الفاتحة."
