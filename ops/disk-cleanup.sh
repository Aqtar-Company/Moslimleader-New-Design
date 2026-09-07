#!/bin/bash
# Install as /etc/cron.daily/disk-cleanup (chmod +x). Runs via anacron/crond.
#
# Retention is capped by COUNT, never by age. See CLAUDE.md → "Backup before any
# deploy" for why: `find -mtime +N` floors the age (a 7-day-18-hour file counts as 7,
# so `+7` skips it), and even a correct age window can't bound a 1.5 GB artifact that
# is produced several times a day. An age condition is also what would delete the ONLY
# remaining backup if deploys stop for a while.
#
# Disk filled twice under age-based retention: 2026-07-23 and 2026-09-07.

# Assets: ~1.5 GB each (private/ PDFs + public/covers + public/products).
# These change rarely and are NOT produced by a deploy — two is plenty.
ls -1t /root/backups/assets-*.tar.gz 2>/dev/null | tail -n +3 | xargs -r rm -f

# DB dumps: ~2 MB each, so being generous is free.
ls -1t /root/backups/db-*.sql.gz 2>/dev/null | tail -n +21 | xargs -r rm -f

journalctl --vacuum-size=200M
find /var/log -type f -regextype posix-extended -regex '.*-[0-9]{8}(\.gz)?$' -mtime +14 -delete
npm cache clean --force 2>/dev/null
find /root/.pm2/logs -type f -mtime +14 -delete
