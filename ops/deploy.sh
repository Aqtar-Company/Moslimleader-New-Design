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

# Whatever fails after `pm2 stop`, the site must not stay down because a script exited.
# `npm ci`, `prisma db push` and `npm run build` all run while the process is stopped, and
# under `set -e` any of them failing used to end the script with nothing restarting it.
# The trap restarts the OLD build (still on disk until `next build` rewrites .next).
# Caveat printed for the one case a restart cannot fix: a half-finished `npm ci` leaves a
# partial node_modules — re-run it, then restart.
trap 'echo; echo "❌ فشل النشر في خطوةٍ ما. أُعيد تشغيل النسخة القديمة كي لا يبقى الموقع متوقفاً."; echo "   لو كان الفشل في npm ci فـ node_modules ناقصة: شغّل npm ci ثم pm2 restart moslimleader --update-env"; pm2 start moslimleader --update-env || true' ERR

# More than node's default heap, and LESS than the machine has.
#
# This was 4096 on a box with 3653 MB of RAM — a ceiling above the whole machine, which is
# no ceiling at all: node never stops itself, the kernel runs out first, and then the OOM
# killer picks the victim by its own reckoning. That could be mysqld, or the OTHER project
# sharing this server. A guard that can take down a neighbour is not a guard.
#
# 3072 is chosen from the measurement, not by feel: the type check died at 1822 MB under
# node's default limit, so three gigabytes is ample, and it leaves the kernel room to
# breathe. Raise it only after watching a build's real peak (`/usr/bin/time -v`).
export NODE_OPTIONS="--max-old-space-size=3072"

TS=$(date +%Y%m%d-%H%M%S)
BASELINE=${TSC_BASELINE:-12}

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
echo "═══ ٣ب. الحزم ═══"
# AFTER the stop: `npm ci` replaces node_modules wholesale, and a live process that loads
# a module mid-swap gets half of one (the stale-Prisma-client window CLAUDE.md warns about).
# Runs only when the lockfile changed. Skipping it when a dependency WAS added means the
# build still passes (`ignoreBuildErrors`) and the route that needs the package crashes at
# runtime instead. The stamp lives in node_modules, so a fresh clone always installs.
LOCK_HASH=$(sha256sum package-lock.json | cut -c1-16)
STAMP=node_modules/.lockfile-installed
if [ ! -d node_modules ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$LOCK_HASH" ]; then
  echo "  package-lock.json تغيّر — npm ci"
  npm ci --no-audit --no-fund
  echo "$LOCK_HASH" > "$STAMP"
else
  echo "  ✅ الحزم مطابقة للقفل — لا تثبيت"
fi

echo
echo "═══ ٤. قاعدة البيانات ═══"
# `db push` asks for confirmation when it would drop data; without a tty it refuses rather
# than guesses, which is the right way round.
npx prisma db push --skip-generate

echo
echo "═══ ٥. فحص الأنواع ═══"
# NOT in a pipe. The exit status has to be tsc's own, and its output has to survive for
# the count below.
# The ERR trap is lifted around this one command: tsc exits non-zero whenever there is
# ANY error, and the baseline below EXPECTS some — `set +e` does not stop an ERR trap
# from firing, so without this the trap announced a failed deploy and restarted the old
# build on every single run, before the gate had even counted.
trap - ERR
set +e
npx tsc --noEmit > /tmp/tsc-out.txt 2>&1
TSC_RC=$?
set -e
trap 'echo; echo "❌ فشل النشر في خطوةٍ ما. أُعيد تشغيل النسخة القديمة كي لا يبقى الموقع متوقفاً."; echo "   لو كان الفشل في npm ci فـ node_modules ناقصة: شغّل npm ci ثم pm2 restart moslimleader --update-env"; pm2 start moslimleader --update-env || true' ERR
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
