#!/usr/bin/env bash
# كم يستغرق ما نُقدّمه لفيسبوك — يُشغَّل على السيرفر.
#
#   cd /home/moslimleader.com/app && bash ops/check-share-preview.sh <معرّف-المنشور>
#
# حوارُ المشاركة يقف على «Posting» وهو ينتظر شيئين: صفحةَ الوسوم، ثم الصورةَ نفسها.
# الأولى عندنا ونعرف زمنها. والثانية عندنا أيضاً حين تكون صورةَ المنشور. وما بعد ذلك عند
# فيسبوك، ولا سبيل لقياسه من هنا — فالغرضُ أن نعرف أي النصفين هو البطيء قبل أن نُصلح
# النصف الخطأ.

set -u
# Default to the newest published post. Requiring an id meant hunting for one, and a
# placeholder in the instructions gets pasted literally — `<...>` is redirection to bash,
# so the command died on a syntax error before the script ever ran.
ID="${1:-}"
if [ -z "$ID" ]; then
  echo "لم يُعطَ معرّف — سأفحص أحدث منشور."
  ID=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.tareeqPost.findFirst({
      where: { isHidden: false, isDraft: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }).then(r => { if (r) console.log(r.id); }).finally(() => p.\$disconnect());
  " 2>/dev/null)
  if [ -z "$ID" ]; then
    echo "تعذّر إيجاد منشور. مرّر المعرّف يدوياً: bash ops/check-share-preview.sh POST_ID"
    exit 1
  fi
  echo "المنشور: $ID"
  echo
fi
URL="https://moslimleader.com/tareeq/$ID"

echo "═══ ١. صفحة الوسوم، كما يراها زاحف فيسبوك ═══"
# facebookexternalhit is what the middleware matches on; a browser UA gets the full page.
read -r code total size < <(curl -s -o /tmp/prev.html \
  -A "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" \
  -w '%{http_code} %{time_total} %{size_download}' --max-time 30 "$URL")
printf '  الحالة: %s   الزمن: %ss   الحجم: %s بايت\n' "$code" "$total" "$size"
HDR=$(curl -s -D - -o /dev/null -A "facebookexternalhit/1.1" --max-time 30 "$URL" | grep -i '^x-tareeq-preview' | tr -d '\r')
printf '  %s\n' "${HDR:-(لا ترويسة x-tareeq-preview — لم يُعَد التوجيه إلى مسار المعاينة!)}"
awk 'BEGIN{RS="<"} /meta property="og:image"/ {print "  og:image → " $0}' /tmp/prev.html \
  | sed 's/meta property="og:image" content="//; s/">$//' | head -1

echo
echo "═══ ٢. الصورة التي سينزّلها ═══"
IMG=$(grep -o 'property="og:image" content="[^"]*"' /tmp/prev.html | head -1 | sed 's/.*content="//; s/"$//')
if [ -z "$IMG" ]; then
  echo "  لم أجد og:image في الصفحة."
else
  read -r icode itotal isize itype < <(curl -s -o /dev/null -L \
    -w '%{http_code} %{time_total} %{size_download} %{content_type}' --max-time 60 "$IMG")
  printf '  %s\n' "$IMG"
  printf '  الحالة: %s   الزمن: %ss   الحجم: %s بايت (%s ميجا)   النوع: %s\n' \
    "$icode" "$itotal" "$isize" "$(awk -v b="$isize" 'BEGIN{printf "%.2f", b/1048576}')" "$itype"
fi

echo
echo "═══ الحكم ═══"
echo "  • صفحة الوسوم فوق ثانية        → العطل عندنا، في مسار المعاينة."
echo "  • الصورة فوق ٣ ثوان أو فوق ٢ ميجا → العطل عندنا، في حجم الصورة:"
echo "    فيسبوك ينزّلها كاملةً قبل أن يسمح بالنشر، وهي صورةٌ خرجت من هاتف بحجمها الأصلي."
echo "  • الاثنان سريعان               → البطء عند فيسبوك، ولا يُصلحه تعديلٌ عندنا."
echo
echo "  وللمقارنة: أول مشاركة لرابطٍ جديد تكون الأبطأ دائماً — يقرأه فيسبوك حينها لأول"
echo "  مرة. أعد التجربة على نفس الرابط وسيكون أسرع من ذاكرته، فإن لم يتحسّن فالبطء دائم."
