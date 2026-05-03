import { prisma } from './prisma';
import { signTrackingPayload } from './marketing-sign';

export interface SegmentFilters {
  boughtProduct?: string;
  notBoughtProduct?: string;
  governorate?: string;
}

interface ShippingAddr { governorate?: string; phone?: string }

interface AggRow {
  userId: string;
  email: string;
  phone: string | null;
  marketingOptIn: boolean;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
  productIds: Set<string>;
  lastGovernorate: string | null;
}

// Resolve which user ids belong to a given segment + filter combo. Mirrors the
// logic in /api/admin/customers/route.ts but returns User rows ready for
// campaign delivery (email + opt-in + token gating).
export async function resolveSegment(
  segmentKey: string,
  filters: SegmentFilters = {},
): Promise<AggRow[]> {
  const orders = await prisma.order.findMany({
    where: { status: { not: 'cancelled' } },
    include: {
      user: { select: { id: true, email: true, phone: true, marketingOptIn: true } },
      items: { select: { productId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const map = new Map<string, AggRow>();
  for (const o of orders) {
    if (!o.user) continue;
    let row = map.get(o.user.id);
    if (!row) {
      row = {
        userId: o.user.id,
        email: o.user.email,
        phone: o.user.phone || null,
        marketingOptIn: o.user.marketingOptIn,
        orderCount: 0,
        totalSpend: 0,
        lastOrderAt: null,
        productIds: new Set<string>(),
        lastGovernorate: null,
      };
      map.set(o.user.id, row);
    }
    row.orderCount += 1;
    row.totalSpend += o.total;
    const ts = o.createdAt.toISOString();
    if (!row.lastOrderAt || ts > row.lastOrderAt) {
      row.lastOrderAt = ts;
      const addr = o.shippingAddress as unknown as ShippingAddr;
      row.lastGovernorate = addr?.governorate || null;
      if (!row.phone && addr?.phone) row.phone = addr.phone;
    }
    for (const it of o.items) row.productIds.add(it.productId);
  }

  const totalProducts = await prisma.product.count();
  const list = Array.from(map.values());
  const now = Date.now();

  // VIP = top 10% by spend
  const sortedBySpend = [...list].sort((a, b) => b.totalSpend - a.totalSpend);
  const vipCount = Math.max(1, Math.ceil(sortedBySpend.length * 0.1));
  const vipIds = new Set(sortedBySpend.slice(0, vipCount).map(r => r.userId));

  const matches = list.filter(r => {
    const days = r.lastOrderAt
      ? Math.floor((now - new Date(r.lastOrderAt).getTime()) / 86400000)
      : null;
    const seg = (() => {
      switch (segmentKey) {
        case 'all':        return true;
        case 'vip':        return vipIds.has(r.userId);
        case 'active':     return days !== null && days <= 90;
        case 'dormant':    return days !== null && days > 90;
        case 'repeat':     return r.orderCount >= 2;
        case 'single':     return r.orderCount === 1;
        case 'bought_all': return totalProducts > 0 && r.productIds.size >= totalProducts;
        default:           return true;
      }
    })();
    if (!seg) return false;
    if (filters.boughtProduct && !r.productIds.has(filters.boughtProduct)) return false;
    if (filters.notBoughtProduct && r.productIds.has(filters.notBoughtProduct)) return false;
    if (filters.governorate && r.lastGovernorate !== filters.governorate) return false;
    return true;
  });

  return matches;
}

// Render a placeholder template ({{name}}, {{firstName}}, {{couponCode}}, {{unsubscribe}}).
export function renderTemplate(
  template: string,
  vars: { name: string; firstName: string; email: string; couponCode?: string; unsubscribeUrl: string },
): string {
  return template
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{firstName\}\}/g, vars.firstName)
    .replace(/\{\{email\}\}/g, vars.email)
    .replace(/\{\{couponCode\}\}/g, vars.couponCode || '')
    .replace(/\{\{unsubscribe\}\}/g, vars.unsubscribeUrl);
}

// Wrap every <a href> in the body with the click-tracking redirect, and append
// the 1×1 open-tracking pixel + unsubscribe footer. URLs are HMAC-signed so
// they can't be enumerated, replayed, or used as an open redirect.
export function instrumentEmailHtml(
  bodyHtml: string,
  cid: string,
  rid: string,
  baseUrl: string,
  unsubscribeUrl: string,
): string {
  const openSig = signTrackingPayload({ cid, rid, kind: 'open' });
  const wrapped = bodyHtml.replace(/href=["']([^"']+)["']/gi, (_m, url) => {
    if (url.startsWith('mailto:') || url.startsWith('#')) return `href="${url}"`;
    const sig = signTrackingPayload({ cid, rid, kind: 'click', u: url });
    const tracked = `${baseUrl}/api/email/track/click?cid=${encodeURIComponent(cid)}&rid=${encodeURIComponent(rid)}&u=${encodeURIComponent(url)}&s=${sig}`;
    return `href="${tracked}"`;
  });
  const pixel = `<img src="${baseUrl}/api/email/track/open?cid=${encodeURIComponent(cid)}&rid=${encodeURIComponent(rid)}&s=${openSig}" width="1" height="1" alt="" style="display:block;border:0;" />`;
  const footer = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center;font-family:Cairo,sans-serif;direction:rtl">
    وصلتك هذه الرسالة لأنك من عملاء Moslim Leader.
    <br><a href="${unsubscribeUrl}" style="color:#888">إلغاء الاشتراك من الحملات التسويقية</a>
  </div>`;
  return `<div style="font-family:Cairo,sans-serif;direction:rtl;max-width:600px;margin:0 auto">${wrapped}${footer}${pixel}</div>`;
}
