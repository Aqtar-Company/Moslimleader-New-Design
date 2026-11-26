#!/usr/bin/env bash
# Why is /media slow or not opening? Read-only; run ON THE SERVER from the app folder.
#
#   bash ops/check-media-speed.sh            # uses the newest audio item
#   bash ops/check-media-speed.sh 54         # a specific item id
#
# Measures each link in the chain separately, because each fails differently:
#   1. the app itself (localhost:3000) — server work + page size
#   2. through nginx + TLS (https)      — what a visitor's browser gets
#   3. the media FILES on R2's public host — where the song/video actually streams from
#   4. the hero picture                  — the biggest thing on the page
#   5. the access log                    — 499 = the visitor gave up waiting; 5xx = we failed
#   6. the app log                       — errors while rendering /media
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
ID="${1:-}"
SITE="https://moslimleader.com"
T='code=%{http_code}  ttfb=%{time_starttransfer}s  total=%{time_total}s  size=%{size_download}B\n'

R2=$(grep -E '^R2_PUBLIC_URL=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')
echo "R2 public host: ${R2:-<not set>}"
case "$R2" in *r2.dev*) echo "  !! this is Cloudflare's r2.dev DEVELOPMENT host — rate-limited, not for production traffic";; esac

# Sample item + files straight from the DB.
read -r SID SURL SCOVER < <(node -e '
const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient();
const id = Number(process.argv[1]) || undefined;
p.freeMedia.findFirst({ where: id ? { id } : { type: "mp3", isPublished: true }, orderBy: { id: "desc" }, select: { id: true, url: true, coverUrl: true } })
 .then(r => { console.log(r ? `${r.id} ${r.url} ${r.coverUrl || "-"}` : "- - -"); return p.$disconnect(); });
' "$ID" 2>/dev/null)
HERO=$(node -e '
const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient();
p.setting.findMany({ where: { key: { contains: "media" } } }).then(rs => { for (const r of rs) { const u = r.value && r.value.url; if (typeof u === "string" && /hero/i.test(r.key)) console.log(u); } return p.$disconnect(); });
' 2>/dev/null | head -1)
abs() { case "$1" in http*) echo "$1";; /*) echo "$SITE$1";; *) echo "";; esac; }

echo; echo "== 1. The app itself (no nginx, no network) =="
for path in /media "/media?kind=audio" "/media/$SID"; do
  printf '%-22s ' "$path"; curl -s -o /dev/null -w "$T" --max-time 30 "http://127.0.0.1:3000$path"
done

echo; echo "== 2. Through nginx + TLS =="
for path in /media "/media/$SID"; do
  printf '%-22s ' "$path"; curl -s -o /dev/null -w "$T" --max-time 30 "$SITE$path"
done
printf '%-22s ' "gzip on /media?"; curl -s -o /dev/null -H 'Accept-Encoding: gzip, br' -w 'size-on-wire=%{size_download}B\n' --max-time 30 "$SITE/media"

echo; echo "== 3. The media files (item #$SID) =="
for f in "$SURL" "$SCOVER"; do
  u=$(abs "$f"); [ -z "$u" ] && continue
  echo "$u"
  curl -s -o /dev/null -r 0-1048575 -w "  first 1MB: $T" --max-time 40 "$u"
  curl -sI --max-time 20 "$u" | grep -iE '^(content-length|cache-control|cf-cache-status|accept-ranges|content-type):' | sed 's/^/  /'
done

echo; echo "== 4. Hero picture =="
if [ -n "$HERO" ]; then u=$(abs "$HERO"); echo "$u"; curl -s -o /dev/null -w "  $T" --max-time 40 "$u"; else echo "  none set"; fi

echo; echo "== 5. Access log: /media requests since the log began, by status =="
LOGS=$(ls /var/log/nginx/moslimleader.access.log* 2>/dev/null)
if [ -n "$LOGS" ]; then
  # shellcheck disable=SC2086
  zcat -f $LOGS | awk '
    $7 ~ /^\/media/ && $7 !~ /_rsc=/ { st[$9]++ ; if ($9 == 499 || $9 >= 500) bad[$9 " " $7]++ }
    END { for (s in st) printf "  %s  %d\n", s, st[s]; for (b in bad) printf "  !! %d × %s\n", bad[b], b }' | sort -k2 -rn | head -25
  echo "  (499 = the visitor closed the page before it answered; 5xx = the server failed)"
else
  echo "  no moslimleader access log"
fi

echo; echo "== 6. App errors mentioning media (last 300 lines) =="
pm2 logs moslimleader --lines 300 --nostream --err 2>/dev/null | grep -iE 'media|ECONN|timeout|heap|killed' | tail -15 || true
