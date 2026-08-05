export function timeAgo(dateStr: string, isRtl: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return isRtl ? `منذ ${d} يوم` : `${d}d ago`;
  if (h > 0) return isRtl ? `منذ ${h} ساعة` : `${h}h ago`;
  return isRtl ? `منذ ${m || 1} دقيقة` : `${m || 1}m ago`;
}
