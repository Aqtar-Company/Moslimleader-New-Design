#!/usr/bin/env bash
# النشر، بحواجز تتوقّف فعلاً حين تفشل.
#
#   cd /home/moslimleader.com/app && bash ops/deploy.sh
#
# ## لماذا سكربت بدل سطرٍ يُلصق
#
# البلوك الذي كان يُلصق حمل حاجزاً لا يحجز: `npx tsc --noEmit | tail -3`. في الأنبوب تكون
# حالةُ الخروج للأمر الأخير — `tail` — فمهما فعل `tsc` يمضي الديبلوي. وحدث ذلك بالفعل:
# مات `tsc` بنفاد الذاكرة ولم يفحص شيئاً، وكمل النشر كأن شيئاً لم يكن. حاجزٌ موجودٌ شكلاً
# وغائبٌ فعلاً أسوأ من غيابه، لأن أحداً لا يعود ينظر.
#
# هنا `set -euo pipefail`، ويُكتب ناتجُ الفحص إلى ملف ثم يُقرأ، ولا يُمرَّر في أنبوب.

set -euo pipefail
cd "$(dirname "$0")/.."

# A tree this size needs more than node's default heap for both the check and the build.
export NODE_OPTIONS="--max-old-space-size=4096"

TS=$(date +%Y%m%d-%H%M%S)
BASELINE=${TSC_BASELINE:-24}

echo "═══ ١. نسخة احتياطية ═══"
mkdir -p /root/backups
mysqldump --single-transaction --routines moslimleader | gzip > "/root/backups/db-$TS.sql.gz"
ls -lh "/root/backups/db-$TS.sql.gz"

echo
echo "═══ ٢. جلب الكود ═══"
git fetch origin main
git reset --hard origin/main
git log --oneline -1

echo
echo "═══ ٣. إيقاف العملية ═══"
# By name. Id 1 on this box is another project entirely.
pm2 stop moslimleader

echo
echo "═══ ٤. قاعدة البيانات ═══"
# `db push` asks for confirmation when it would drop data; without a tty it refuses rather
# than guesses, which is the right way round.
npx prisma db push --skip-generate

echo
echo "═══ ٥. فحص الأنواع ═══"
# NOT in a pipe. The exit status has to be tsc's own, and its output has to survive for
# the count below.
set +e
npx tsc --noEmit > /tmp/tsc-out.txt 2>&1
TSC_RC=$?
set -e
ERRORS=$(grep -c 'error TS' /tmp/tsc-out.txt || true)
echo "  أخطاء: $ERRORS   (المتوقّع: $BASELINE)"
if [ "$TSC_RC" -gt 2 ] || grep -q 'heap out of memory' /tmp/tsc-out.txt; then
  echo "  ❌ لم يكتمل الفحص (خرج بـ$TSC_RC). هذا ليس نجاحاً — توقّف واقرأ /tmp/tsc-out.txt"
  pm2 start moslimleader --update-env
  exit 1
fi
if [ "$ERRORS" -gt "$BASELINE" ]; then
  echo "  ❌ أخطاء جديدة — أول عشرة:"
  grep 'error TS' /tmp/tsc-out.txt | head -10 | sed 's/^/     /'
  echo "  العملية ستعود للعمل بالبناء القديم. صحّح أولاً."
  pm2 start moslimleader --update-env
  exit 1
fi
echo "  ✅ لا جديد"

echo
echo "═══ ٦. البناء ═══"
npm run build

echo
echo "═══ ٧. التشغيل ═══"
ls -la .next/BUILD_ID
pm2 start moslimleader --update-env
pm2 save

echo
bash ops/verify-sync.sh
