#!/bin/bash
# Daily database backup for moslimleader.
#
# Why this exists as its own cron job: the dump used to live inside the deploy command,
# pasted by hand. So a week with no deploy was a week with no backup, and the backup
# depended on someone remembering. It is now independent of the habit.
#
# Install:
#   cp ops/daily-db-backup.sh /usr/local/bin/moslimleader-db-backup
#   chmod +x /usr/local/bin/moslimleader-db-backup
#   ( crontab -l 2>/dev/null; echo '30 3 * * * /usr/local/bin/moslimleader-db-backup' ) | crontab -
#
# Retention is by COUNT, never by age — see the note in CLAUDE.md. An age window is what
# filled this disk twice, and it can also delete the only remaining backup if backups stop
# for a while.

set -uo pipefail

DB=moslimleader
DIR=/root/backups
KEEP=20

mkdir -p "$DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$DIR/db-$TS.sql.gz"

# --single-transaction keeps this from locking the tables the live site is reading.
if ! mysqldump --single-transaction --routines "$DB" | gzip > "$OUT"; then
  echo "moslimleader-db-backup: dump FAILED" >&2
  rm -f "$OUT"
  exit 1
fi

# A dump that failed halfway still leaves a file, and a tiny file is the signature. Better
# to fail loudly now than to discover it on the day it is needed.
SIZE=$(stat -c%s "$OUT" 2>/dev/null || echo 0)
if [ "$SIZE" -lt 100000 ]; then
  echo "moslimleader-db-backup: dump suspiciously small ($SIZE bytes) — keeping it, but check" >&2
fi

# Keep the newest $KEEP, delete the rest. No age condition anywhere.
ls -1t "$DIR"/db-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

exit 0
