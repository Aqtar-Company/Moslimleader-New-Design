#!/usr/bin/env bash
# تشغيل مجدول لطابور الريلز.
#
# التركيب على السيرفر (CentOS/RHEL 9):
#   cp ops/reels-cron.sh /etc/cron.daily/reels-studio
#   chmod +x /etc/cron.daily/reels-studio
#
# أو بتوقيت محدد — كل يوم 3 صباحاً:
#   crontab -e
#   0 3 * * * /home/moslimleader.com/app/reels-studio/ops/reels-cron.sh
#
# ملاحظة مهمة: كل تشغيل بيصرف فلوس حقيقية على Veo API.
# ابدأ بـ REELS_QUEUE_LIMIT=1 وراجع الناتج قبل ما ترفعه.

set -euo pipefail

STUDIO_DIR="${REELS_STUDIO_DIR:-/home/moslimleader.com/app/reels-studio}"
LIMIT="${REELS_QUEUE_LIMIT:-1}"
LOG_DIR="${STUDIO_DIR}/logs"
LOG_FILE="${LOG_DIR}/cron-$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

{
  echo "═══ $(date -Is) — بدء تشغيل الطابور (حد أقصى ${LIMIT}) ═══"

  cd "$STUDIO_DIR"

  # قفل: يمنع تشغيلين متوازيين لو التشغيل السابق لسه شغال.
  # التوليد بياخد دقايق، والتداخل بيصرف فلوس على نفس المهمة مرتين.
  exec 9>"${STUDIO_DIR}/.cron.lock"
  if ! flock -n 9; then
    echo "تشغيل سابق لسه شغال — تم التخطي."
    exit 0
  fi

  node src/cli.mjs run-queue --limit "$LIMIT"

  echo "═══ $(date -Is) — انتهى ═══"
} >>"$LOG_FILE" 2>&1

# تنظيف اللوجّات: نحتفظ بأحدث 30 ملف بالعدد، من غير أي شرط عمر.
# (نفس سياسة ops/disk-cleanup.sh في المشروع الأساسي — الشرط الزمني هو
#  اللي فشل مرتين هناك وملى الديسك.)
ls -1t "${LOG_DIR}"/cron-*.log 2>/dev/null | tail -n +31 | xargs -r rm -f
