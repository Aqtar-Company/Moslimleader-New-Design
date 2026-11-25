#!/usr/bin/env bash
# Visits to moslimleader.com, read from its OWN nginx log.
#
#   bash ops/visits.sh            # every day the log holds
#   bash ops/visits.sh 7          # the last 7 days only
#
# Read-only. Counts only what nginx saw since 2026-11-15 — before that every site on the
# box shared /var/log/nginx/access.log with no host field, so older visits cannot be told
# apart from the other projects' (see CLAUDE.md).
#
# What counts as a PAGE VIEW: a GET answered 200, for a page (not /_next/, /api/, a file
# with an extension, or a Next client-side prefetch `_rsc=`), from a client that is not a
# known bot. A full page load only — moving between pages inside the open site is not
# re-counted, so this is a floor, not an inflated number.
# VISITOR = one IP + browser per day; "unique over the period" = distinct IP + browser.
# Both are approximations: a family on one Wi-Fi is one visitor, a phone that changes
# network is two.
set -euo pipefail
LOG_GLOB="/var/log/nginx/moslimleader.access.log*"
DAYS="${1:-0}"

# shellcheck disable=SC2086
if ! ls $LOG_GLOB >/dev/null 2>&1; then
  echo "No log at $LOG_GLOB — is access_log set in /etc/nginx/conf.d/moslimleader.conf?" >&2
  exit 1
fi

# shellcheck disable=SC2086
zcat -f $LOG_GLOB | awk -F'"' -v days="$DAYS" '
BEGIN {
  split("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec", m, " ")
  for (i = 1; i <= 12; i++) mon[m[i]] = sprintf("%02d", i)
  bot = "bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|preview|curl|wget|python|go-http|headless|lighthouse|monitor|uptime|axios|node-fetch|java/|scrapy|httpclient|okhttp|libwww|semrush|ahrefs|petal|bytespider|gptbot|claude|perplexity|^-$|^$"
  if (days > 0) cutoff = strftime("%Y-%m-%d", systime() - days * 86400)
}
{
  split($1, a, " "); ip = a[1]
  d = substr(a[4], 2, 11)                       # 15/Nov/2026
  split(d, dp, "/"); day = dp[3] "-" mon[dp[2]] "-" dp[1]
  if (cutoff != "" && day < cutoff) next
  split($2, r, " "); method = r[1]; path = r[2]
  split($3, s, " "); status = s[1]
  ua = $6; ref = $4
  if (method != "GET" || status != "200") next
  if (path ~ /^\/(_next|api)\// || path ~ /_rsc=/) next
  p = path; sub(/\?.*/, "", p)
  if (p ~ /\.[A-Za-z0-9]{2,5}$/) next
  if (tolower(ua) ~ bot) next

  views[day]++; total++
  v = ip "|" ua
  if (!((day, v) in seenDay)) { seenDay[day, v] = 1; visitors[day]++ }
  if (!(v in seenAll)) { seenAll[v] = 1; uniq++ }
  if (p ~ /^\/en(\/|$)/) en++
  sub(/^\/en(\/|$)/, "/", p); sub(/\/[0-9a-z]{20,}$/, "/<id>", p); sub(/\/[0-9]+$/, "/<n>", p)
  page[p]++
  if (ref == "-" || ref == "") src["مباشر / تطبيق"]++
  else {
    h = ref; sub(/^[a-z]+:\/\//, "", h); sub(/\/.*/, "", h); sub(/^(www|m|l|lm|web)\./, "", h)
    if (h ~ /moslimleader\.com$/) src["داخل الموقع"]++
    else src[h]++
  }
}
END {
  if (!total) { print "No page views in this period."; exit }
  print "\n== Day by day =="
  printf "%-12s %10s %10s\n", "day", "visitors", "views"
  n = 0; for (k in views) keys[++n] = k
  for (i = 2; i <= n; i++) { t = keys[i]; j = i - 1; while (j > 0 && keys[j] > t) { keys[j + 1] = keys[j]; j-- } keys[j + 1] = t }
  for (i = 1; i <= n; i++) { printf "%-12s %10d %10d\n", keys[i], visitors[keys[i]], views[keys[i]]; vsum += visitors[keys[i]] }
  printf "\nDays: %d   page views: %d   visitor-days: %d   unique visitors: %d\n", n, total, vsum, uniq
  printf "Average per day: %d visitors, %d views\n", vsum / n, total / n
  printf "English pages (/en): %d (%.1f%%)\n", en, 100 * en / total
  print "\n== Top pages =="
  for (k in page) printf "%8d  %s\n", page[k], k | "sort -rn | head -20"
  close("sort -rn | head -20")
  print "\n== Where they came from =="
  for (k in src) printf "%8d  %s\n", src[k], k | "sort -rn | head -12"
  close("sort -rn | head -12")
}'
