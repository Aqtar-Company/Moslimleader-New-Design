#!/usr/bin/env bash
# هل جيت-هَب والسيرفر والبيلد الشغّال وقاعدة البيانات كلهم على نفس الشيء؟
#
#   cd /home/moslimleader.com/app && bash ops/verify-sync.sh
#
# يقرأ فقط. لا يبني ولا يعيد تشغيل ولا يلمس قاعدة البيانات.
#
# ## لماذا لا تكفي مقارنة SHA واحد
#
# «الملفات محدَّثة» و«الموقع يعمل بالجديد» شيئان مختلفان. `git reset` يغيّر ما على القرص
# في لحظة؛ العملية الحيّة تظل على البيلد القديم حتى تُعاد تهيئتها. وقد حدث هذا هنا:
# البيلد انقطع، و`pm2 restart <id>` أخطأ الرقم، فظل الموقع شهوراً يخدم بناءً قديماً
# بينما `git log` يقول إن كل شيء على ما يرام. فالفحص هنا أربعُ طبقات:
#
#   ١. جيت-هَب  ← ما نُشر
#   ٢. القرص     ← ما جُلب
#   ٣. البيلد    ← ما بُني بعد الجلب
#   ٤. العملية   ← ما يُخدَم الآن
#
# ثم قاعدة البيانات، لأن سكيما ناقصة عموداً لا تُرى إلا حين يسقط طلبُ مستخدم.

set -u
cd "$(dirname "$0")/.." || exit 1

ok=0; bad=0
say_ok()  { printf '  ✅ %s\n' "$1"; ok=$((ok+1)); }
say_bad() { printf '  ❌ %s\n' "$1"; bad=$((bad+1)); }
say_note(){ printf '     %s\n' "$1"; }

echo "═══ ١. جيت-هَب ↔ القرص ═══"
git fetch origin main --quiet 2>/dev/null
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)
printf '  القرص   : %s\n' "${LOCAL:0:7}"
printf '  جيت-هَب : %s\n' "${REMOTE:0:7}"
if [ "$LOCAL" = "$REMOTE" ]; then say_ok "متطابقان"
else
  say_bad "مختلفان — الجلب لم يتم أو فشل"
  say_note "العلاج: git fetch origin main && git reset --hard origin/main"
fi

# Uncommitted changes on a production checkout mean somebody edited a file in place, and
# the next deploy will silently discard it.
DIRTY=$(git status --porcelain 2>/dev/null | grep -v '^??' | head -5)
if [ -n "$DIRTY" ]; then
  say_bad "تعديلات غير محفوظة على السيرفر — سيمحوها أول ديبلوي:"
  echo "$DIRTY" | sed 's/^/       /'
else
  say_ok "لا تعديلات محلية"
fi

echo
echo "═══ ٢. البيلد ═══"
if [ ! -f .next/BUILD_ID ]; then
  say_bad ".next/BUILD_ID غير موجود — البيلد ناقص أو انقطع"
  say_note "PM2 سيدخل في حلقة انهيار بعد أي ريبوت. العلاج: npm run build"
else
  BUILD_TS=$(stat -c %Y .next/BUILD_ID 2>/dev/null || stat -f %m .next/BUILD_ID)
  # The last commit that can CHANGE the build, not simply the last commit. An ops script,
  # a README or a note in CLAUDE.md is newer than the build by definition the moment it is
  # pulled, and reporting that as "the site is serving stale code" is a false alarm that
  # teaches people to ignore the check — which is worse than not having it.
  COMMIT_TS=$(git log -1 --format=%ct -- src prisma public package.json package-lock.json next.config.mjs tsconfig.json 2>/dev/null)
  [ -z "$COMMIT_TS" ] && COMMIT_TS=$(git log -1 --format=%ct 2>/dev/null)
  printf '  آخر كوميت يمسّ البيلد : %s\n' "$(date -d "@$COMMIT_TS" '+%Y-%m-%d %H:%M' 2>/dev/null || date -r "$COMMIT_TS" '+%Y-%m-%d %H:%M')"
  printf '  آخر بيلد              : %s\n' "$(date -d "@$BUILD_TS" '+%Y-%m-%d %H:%M' 2>/dev/null || date -r "$BUILD_TS" '+%Y-%m-%d %H:%M')"
  if [ "$BUILD_TS" -ge "$COMMIT_TS" ]; then say_ok "البيلد أحدث من الكوميت"
  else
    say_bad "البيلد أقدم من الكود — الملفات جديدة والمبني قديم"
    say_note "العلاج: pm2 stop moslimleader && npm run build && pm2 start moslimleader --update-env"
  fi
fi

echo
echo "═══ ٣. العملية الحيّة ═══"
# By NAME, never by number: id 1 on this box is a different project entirely.
PM2_LINE=$(pm2 jlist 2>/dev/null | node -e "
let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
  try {
    const p = JSON.parse(s).find(x => x.name === 'moslimleader');
    if (!p) { console.log('MISSING'); return; }
    console.log([p.pm2_env.status, p.pm2_env.pm_uptime, p.pm2_env.restart_time].join('|'));
  } catch { console.log('MISSING'); }
});" 2>/dev/null)

if [ "$PM2_LINE" = "MISSING" ] || [ -z "$PM2_LINE" ]; then
  say_bad "لم أجد عملية باسم moslimleader في PM2"
  say_note "شغّل: pm2 list"
else
  STATUS=${PM2_LINE%%|*}; rest=${PM2_LINE#*|}; UPMS=${rest%%|*}; RESTARTS=${rest##*|}
  UP_TS=$((UPMS / 1000))
  printf '  الحالة    : %s   (إعادات التشغيل: %s)\n' "$STATUS" "$RESTARTS"
  printf '  تعمل منذ  : %s\n' "$(date -d "@$UP_TS" '+%Y-%m-%d %H:%M' 2>/dev/null || date -r "$UP_TS" '+%Y-%m-%d %H:%M')"
  [ "$STATUS" = "online" ] && say_ok "تعمل" || say_bad "ليست online"
  if [ -f .next/BUILD_ID ]; then
    if [ "$UP_TS" -ge "$BUILD_TS" ]; then say_ok "أُعيد تشغيلها بعد البيلد — تخدم الجديد"
    else
      say_bad "تعمل منذ ما قبل البيلد — لا تزال تخدم القديم"
      say_note "وهذا هو العطل الذي لا يظهر في git log. العلاج: pm2 restart moslimleader --update-env"
    fi
  fi
fi

echo
echo "═══ ٤. الموقع ═══"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://moslimleader.com/ 2>/dev/null)
[ "$CODE" = "200" ] && say_ok "https://moslimleader.com → $CODE" || say_bad "https://moslimleader.com → $CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://moslimleader.com/tareeq 2>/dev/null)
[ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "302" ] \
  && say_ok "/tareeq → $CODE" || say_bad "/tareeq → $CODE"

echo
echo "═══ ٥. قاعدة البيانات ↔ السكيما ═══"
# A missing column does not show up anywhere until a user's request falls over on it.
DIFF=$(npx prisma migrate diff \
        --from-schema-datasource prisma/schema.prisma \
        --to-schema-datamodel prisma/schema.prisma \
        --exit-code 2>&1)
RC=$?
if [ $RC -eq 0 ]; then say_ok "القاعدة مطابقة للسكيما"
elif [ $RC -eq 2 ]; then
  say_bad "القاعدة ناقصة عن السكيما — أعمدة في الكود وليست في الجدول"
  echo "$DIFF" | head -12 | sed 's/^/       /'
  say_note "العلاج: npx prisma db push --skip-generate   (وإن حذّر من فقدان بيانات → N وتوقّف)"
else
  say_bad "تعذّر الفحص (RC=$RC):"
  echo "$DIFF" | head -4 | sed 's/^/       /'
fi

echo
echo "═══ ٦. الذاكرة ═══"
MEM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
if [ -n "$MEM_MB" ]; then
  printf '  ذاكرة الجهاز : %s ميجا\n' "$MEM_MB"
  # `tsc` and `next build` both need more than node's default heap on a tree this size.
  # The type check in the deploy block died of exactly this, silently, because its exit
  # code was swallowed by the pipe it was written into.
  # A heap ceiling at or above physical RAM is not a ceiling: node never stops itself, the
  # kernel runs out first, and the OOM killer chooses the victim — possibly mysqld or the
  # other project on this box.
  case "${NODE_OPTIONS:-}" in
    *max-old-space-size=*)
      HEAP=$(printf '%s' "$NODE_OPTIONS" | sed -n 's/.*max-old-space-size=\([0-9]*\).*/\1/p')
      if [ -n "$HEAP" ] && [ "$HEAP" -ge "$MEM_MB" ]; then
        say_bad "حدّ الكومة ($HEAP م) ≥ رام الجهاز ($MEM_MB م) — ليس حدّاً"
        say_note "اجعله نحو ٨٠٪ مما يتوفّر: ذاكرةٌ تنفد يحكمها OOM killer، وقد يختار mysqld أو المشروع الآخر"
      else
        say_ok "حدّ الكومة $HEAP م، دون رام الجهاز"
      fi
      ;;
    *) say_note "NODE_OPTIONS غير مضبوط في هذه الجلسة — مرّره في أمر البناء نفسه" ;;
  esac
fi

echo
echo "═══ الخلاصة ═══"
if [ $bad -eq 0 ]; then
  echo "  كل شيء متطابق ($ok فحصاً)."
else
  echo "  $bad مشكلة من أصل $((ok+bad)) فحصاً. اقرأ ❌ أعلاه."
  exit 1
fi
