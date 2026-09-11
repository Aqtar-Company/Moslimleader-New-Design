#!/usr/bin/env bash
# تنظيف مخرجات الريلز — بسياسة العدد، مش العمر.
#
# التركيب:
#   cp ops/reels-cleanup.sh /etc/cron.daily/reels-cleanup
#   chmod +x /etc/cron.daily/reels-cleanup
#
# ليه العدد مش العمر؟ نفس الدرس اللي اتعلمناه مرتين في /root/backups:
#   • find -mtime +N بيقرّب لأسفل، فملف عمره 7 أيام و18 ساعة بينجو يوم زيادة.
#   • وحتى لو ظبطناه، النافذة الزمنية مابتحدّش الحجم النهائي — عدد الريلز
#     في اليوم هو اللي بيحدده، وده متغير.
#   • والأخطر: الشرط الزمني ممكن يمسح آخر نسخة موجودة لو الإنتاج وقف فترة.
# سقف بالعدد = سقف حجم ثابت ومضمون.
#
# الريل الواحد ~7 ميجا بعد التنظيف التلقائي للملفات الوسيطة.
# KEEP=60 يعني ~420 ميجا كحد أقصى، للأبد.

set -euo pipefail

STUDIO_DIR="${REELS_STUDIO_DIR:-/home/moslimleader.com/app/reels-studio}"
OUT_DIR="${STUDIO_DIR}/out"
KEEP="${REELS_KEEP_REELS:-60}"

[ -d "$OUT_DIR" ] || exit 0

# نرتب مجلدات الريلز بالأحدث ونحذف اللي بعد الحد.
# -maxdepth/-mindepth 1: مجلدات الريلز نفسها بس، مش اللي جواها.
mapfile -t stale < <(
  find "$OUT_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -rn \
    | tail -n "+$((KEEP + 1))" \
    | cut -d' ' -f2-
)

for dir in "${stale[@]:-}"; do
  [ -n "$dir" ] || continue
  echo "حذف ريل قديم: $(basename "$dir")"
  rm -rf "$dir"
done

# مهام الطابور المنتهية: نحتفظ بآخر 200 للسجل.
# find مش ls: الـ glob الفاضي بيخلي ls يرجّع خطأ، ومع pipefail ده بيوقف السكربت كله.
QUEUE_DIR="${STUDIO_DIR}/queue"
if [ -d "$QUEUE_DIR" ]; then
  find "$QUEUE_DIR" -maxdepth 1 -type f -name '*.json' -printf '%T@ %p\n' \
    | sort -rn | tail -n +201 | cut -d' ' -f2- | xargs -r rm -f
fi

echo "التنظيف تم — متبقي $(find "$OUT_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l) ريل، الحجم $(du -sh "$OUT_DIR" 2>/dev/null | cut -f1)"
