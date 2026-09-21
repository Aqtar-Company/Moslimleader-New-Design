#!/usr/bin/env bash
# فحص روابط القرّاء في قرآن نوري — يُشغَّل على السيرفر، لا في بيئة التطوير.
#
# لماذا سكربت وليس اختبارًا داخل المشروع: كل رابطٍ هنا خارجيّ، وبيئة التطوير
# محجوبةٌ عن الشبكة. والعطل الذي يُصلحه هذا الفحص صامت: معرّفُ قارئٍ خاطئٌ
# بحرفٍ واحد يعني 404 على كل آية، والمشغّل لا يملك أن يُظهره إلا سكوتًا.
#
#   bash ops/check-reciters.sh
#
# المخرجات: سطرٌ لكل قارئ. 200 أو 206 يعني يعمل. أي شيءٍ آخر يعني لا يعمل،
# وعندها صحّح المعرّف في src/lib/quran-reciters.ts أو احذف القارئ.

set -u

CDN="https://cdn.islamic.network/quran/audio/128"
IBRAHIM="https://ibrahimquran.com/quran"

# يُطلب أولُ 200 بايتٍ فقط: يكفي للتحقق ولا يُنزّل الملف.
probe() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 25 -r 0-200 "$1" 2>/dev/null
}

ok_code() { [ "$1" = "200" ] || [ "$1" = "206" ]; }

echo "═══ القرّاء المُعرَّفون في التطبيق (ملفٌ لكل آية) ═══"
# المعرّفات كما في src/lib/quran-reciters.ts
CONFIGURED="ar.alafasy ar.husary ar.husarymujawwad ar.minshawi ar.mahermuaiqly ar.shaatree ar.ahmedajamy ar.hudhaify ar.muhammadayyoub ar.muhammadjibreel"
FAILED=""
for id in $CONFIGURED; do
  # الآية 1 (الفاتحة) والآية 262 (منتصف البقرة) — ملفٌ واحدٌ ناجحٌ قد يكون صدفة.
  c1=$(probe "$CDN/$id/1.mp3")
  c2=$(probe "$CDN/$id/262.mp3")
  # 403 ≠ 404: 403 يعني أن المعرّف صحيح وأن الـCDN يرفض خدمة هذه التلاوة، ولا
  # يُصلحه تصحيحُ إملاء. أما 404 فيعني معرّفًا مكتوبًا خطأً.
  if ok_code "$c1" && ok_code "$c2"; then
    printf '  ✅ %-26s %s %s\n' "$id" "$c1" "$c2"
  else
    printf '  ❌ %-26s %s %s\n' "$id" "$c1" "$c2"
    FAILED="$FAILED $id"
  fi
done

if [ -n "$FAILED" ]; then
  echo
  echo "═══ بدائل مُحتملة للمعرّفات الفاشلة ═══"
  echo "  (جرِّبها ثم ضع الناجح في src/lib/quran-reciters.ts)"
  CANDIDATES="ar.abdulbasitmurattal ar.abdulsamad ar.minshawi ar.minshawimujawwad
              ar.husary ar.husarymujawwad ar.abdurrahmaansudais ar.abdurrahmansudais
              ar.shaatree ar.ahmedajamy ar.hanirifai ar.hudhaify ar.mahermuaiqly
              ar.muhammadayyoub ar.muhammadjibreel ar.aymanswoaid ar.saoodshuraym"
  for id in $CANDIDATES; do
    c=$(probe "$CDN/$id/1.mp3")
    if ok_code "$c"; then printf '  ✅ %-26s %s\n' "$id" "$c"
    else printf '  ·  %-26s %s\n' "$id" "$c"; fi
  done
fi

echo
echo "═══ القرّاء المُعرَّفون على everyayah (مفتاحه سورة+آية) ═══"
EA="https://everyayah.com/data"
for d in Husary_128kbps; do
  c1=$(probe "$EA/$d/001001.mp3")
  c2=$(probe "$EA/$d/002255.mp3")
  if ok_code "$c1" && ok_code "$c2"; then printf '  ✅ %-26s %s %s\n' "$d" "$c1" "$c2"
  else printf '  ❌ %-26s %s %s\n' "$d" "$c1" "$c2"; fi
done

echo
echo "═══ تلاوة د. إبراهيم حسن (ملفٌ لكل وجه) ═══"
for page in 1 42 604; do
  c=$(probe "$IBRAHIM/khatma/$page.mp3")
  if ok_code "$c"; then printf '  ✅ khatma/%-10s %s\n' "$page.mp3" "$c"
  else printf '  ❌ khatma/%-10s %s\n' "$page.mp3" "$c"; fi
done
echo "  — الوجهان الغائبان من khatma وبديلاهما (المسافات مُرمَّزة %20):"
for pair in "504|pages/46%20Page%203.mp3" "566|pages/68%20Page%203.mp3"; do
  page="${pair%%|*}"; alt="${pair##*|}"
  cm=$(probe "$IBRAHIM/khatma/$page.mp3")
  ca=$(probe "$IBRAHIM/$alt")
  printf '     %s: khatma=%s  بديل=%s %s\n' "$page" "$cm" "$ca" "$(ok_code "$ca" && echo '✅' || echo '❌')"
done

echo
echo "═══ بحثٌ عن تلاوة الحصري المرتّلة (نسخة الإذاعة المصرية) ═══"
echo "  افتح الروابط الناجحة في المتصفّح واسمعها، وقل لي أيُّها هي."
echo "  ── على cdn.islamic.network (مفتاحه رقم الآية بين 6236):"
for id in ar.husary ar.husarymujawwad ar.husarymuallim ar.husary128 ar.mahmoudkhalilalhussary; do
  c=$(probe "$CDN/$id/262.mp3")
  if ok_code "$c"; then printf '     ✅ %-28s %s\n        %s/%s/262.mp3\n' "$id" "$c" "$CDN" "$id"
  else printf '     ·  %-28s %s\n' "$id" "$c"; fi
done
echo "  ── على everyayah.com (مفتاحه سورة 3 أرقام + آية 3 أرقام — 002255 = آية الكرسي):"
for d in Husary_128kbps Husary_64kbps Husary_Mujawwad_64kbps Husary_Muallim_128kbps Husary_Mujawwad_128kbps; do
  c=$(probe "$EA/$d/002255.mp3")
  if ok_code "$c"; then printf '     ✅ %-28s %s\n        %s/%s/002255.mp3\n' "$d" "$c" "$EA" "$d"
  else printf '     ·  %-28s %s\n' "$d" "$c"; fi
done

echo
echo "═══ ملف التوقيتات على موقعنا ═══"
c=$(probe "https://moslimleader.com/quran/ibrahim-timings.json")
if ok_code "$c"; then echo "  ✅ /quran/ibrahim-timings.json $c"
else echo "  ❌ /quran/ibrahim-timings.json $c  (لم يُنشر بعد؟ شغّل الديبلوي)"; fi

echo
echo "تمّ. أي ❌ في القسم الأول يعني قارئًا لا يعمل داخل التطبيق."
