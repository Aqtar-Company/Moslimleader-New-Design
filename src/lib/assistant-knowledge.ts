import { prisma } from './prisma';
import { products as staticProducts } from './products';
import { applyOverride, loadStaticOverrides } from './product-overrides';
import { COUNTRY_CURRENCIES, countryToZone } from './geo-pricing';
import type { Product } from '@/types';

// Knowledge-base assembler for the AI Facebook Assistant.
//
// Instead of fine-tuning a model (expensive + slow + fragile when
// the catalogue changes), we build a SNAPSHOT of the site's facts
// and prepend it to every system prompt. The bot then has live
// access to: every product, every book, current shipping rates,
// active coupons, and any custom FAQs the owner wrote.
//
// Cached in-memory for 5 minutes so a flurry of messages doesn't
// hammer the DB. Invalidated automatically by the cache TTL —
// admin doesn't need to refresh manually.

export interface RawContextProduct {
  name: string;
  slug: string;
  price: number;
  priceUsd?: number;
}

export interface AssistantContext {
  /** The text block injected into the system prompt. Arabic, ~3K tokens max. */
  text: string;
  /** Raw product list for generating localized price blocks per user country. */
  rawProducts: RawContextProduct[];
  /** Raw book list for localized pricing. */
  rawBooks: RawContextBook[];
  /** Raw series list for localized pricing. */
  rawSeries: RawContextSeries[];
  /** Coarse stats so the admin UI can show "what the bot knows". */
  stats: {
    productCount: number;
    bookCount: number;
    seriesCount: number;
    shippingZoneCount: number;
    couponCount: number;
    faqCount: number;
    builtAt: string;
    approxChars: number;
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; ctx: AssistantContext } | null = null;

export function invalidateAssistantContext() { cache = null; }

export async function buildAssistantContext(): Promise<AssistantContext> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.ctx;

  const [
    dbProducts,
    books,
    seriesList,
    shipping,
    coupons,
    faqRow,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { inStock: true },
      select: {
        id: true, slug: true, name: true, nameEn: true, price: true, priceUsd: true,
        category: true, source: true, shortDescription: true,
        // Sales context fields: age range (B1), stock level (B3),
        // review aggregate (B3 social proof).
        minAge: true, maxAge: true, ageCategory: true,
        needsParentalGuide: true,
        stock: true, variantStocks: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    }).catch(() => []),
    prisma.book.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, titleEn: true, price: true, freePages: true },
      orderBy: { title: 'asc' },
      take: 100,
    }).catch(() => []),
    prisma.bookSeries.findMany({
      select: { id: true, name: true, seriesPrice: true, description: true },
      take: 50,
    }).catch(() => []),
    prisma.shippingRate.findMany({
      orderBy: { rate: 'asc' },
      take: 30,
    }).catch(() => []),
    prisma.coupon.findMany({
      where: { isActive: true },
      select: { code: true, discount: true, showBanner: true },
      take: 20,
    }).catch(() => []),
    prisma.setting.findUnique({ where: { key: 'assistant-faqs' } }).catch(() => null),
  ]);

  // Merge static-product overrides so prices in the context match
  // what the customer sees on the site.
  type ContextProduct = Pick<Product, 'name' | 'slug' | 'category' | 'price'> & {
    id?: string;
    priceUsd?: number;
    shortDescription?: string;
    minAge?: number | null;
    maxAge?: number | null;
    needsParentalGuide?: boolean;
    stock?: number;
    variantStocks?: unknown;
    reviewCount?: number;
    avgRating?: number;
  };
  let products: ContextProduct[] = [];
  try {
    const overrides = await loadStaticOverrides();
    products = dbProducts.map(p => {
      if (p.source === 'static') {
        const merged = applyOverride(p as unknown as Product, overrides[p.id]);
        return merged ?? p;
      }
      return p;
    }) as ContextProduct[];
  } catch {
    products = dbProducts as ContextProduct[];
  }

  // Pull review aggregates for social-proof context. One groupBy
  // covers all products; products without reviews keep count=0.
  try {
    const reviewAgg = await prisma.review.groupBy({
      by: ['productId'],
      _count: { _all: true },
      _avg: { rating: true },
      where: { approved: true },
    });
    const reviewMap = new Map(reviewAgg.map(r => [
      r.productId,
      { count: r._count._all, avg: Number(r._avg.rating ?? 0) },
    ]));
    for (const p of products) {
      const r = p.id ? reviewMap.get(p.id) : undefined;
      if (r) {
        p.reviewCount = r.count;
        p.avgRating = r.avg;
      }
    }
  } catch {
    /* tolerate — reviews are optional context */
  }

  // Static products that aren't in the DB yet (catalogue fallback).
  const dbSlugs = new Set(products.map(p => p.slug));
  for (const sp of staticProducts) {
    if (dbSlugs.has(sp.slug)) continue;
    products.push({
      name: sp.name,
      slug: sp.slug,
      category: sp.category,
      price: sp.price,
      priceUsd: (sp as { priceUsd?: number }).priceUsd,
      shortDescription: sp.shortDescription,
    });
  }

  // ── Build the Arabic context block ──
  const lines: string[] = [];
  lines.push('## معلومات حقيقية ومحدّثة عن متجر مسلم ليدر — استند إليها في إجاباتك:');
  lines.push('');

  // Products by category for readability.
  if (products.length > 0) {
    lines.push(`### المنتجات (${products.length} منتج):`);

    // Render one product line with all sales-context signals
    // (age range, stock scarcity, review social proof). Closure
    // so we keep formatting in one place.
    const renderProductLine = (p: ContextProduct): string => {
      const short = p.shortDescription ? ` — ${p.shortDescription.slice(0, 80)}` : '';
      const url   = `https://moslimleader.com/shop/${p.slug}`;

      const parts: string[] = [
        `- ${p.name}${short}`,
        `${Math.round(p.price)} ج.م`,
      ];
      // Age range — explicit signal so the model can match recommendations.
      if (p.minAge !== null && p.minAge !== undefined && p.maxAge !== null && p.maxAge !== undefined) {
        parts.push(`عمر ${p.minAge}-${p.maxAge}`);
      } else if (p.minAge !== null && p.minAge !== undefined) {
        parts.push(`من عمر ${p.minAge}+`);
      }
      if (p.needsParentalGuide) parts.push('👨‍👩‍👧 يحتاج مساعدة الوالدين');
      // Scarcity — only when low (≤5) so we don't lie about abundance.
      const stockNum = (() => {
        if (p.variantStocks && typeof p.variantStocks === 'object') {
          return Object.values(p.variantStocks as Record<string, number>)
            .reduce((s, n) => s + (Number.isFinite(n) ? Number(n) : 0), 0);
        }
        return typeof p.stock === 'number' ? p.stock : null;
      })();
      if (stockNum !== null && stockNum > 0 && stockNum <= 5) {
        parts.push(`متبقي ${stockNum} نسخ فقط ⚡`);
      }
      // Social proof — review count + avg rating.
      if (p.reviewCount && p.reviewCount > 0) {
        parts.push(`⭐${(p.avgRating ?? 0).toFixed(1)} (${p.reviewCount} تقييم)`);
      }
      parts.push(url);
      return parts.join(' | ');
    };

    // Group by AGE first (more useful for recommendations), then by
    // category within each age band. Falls back to "كل الأعمار" for
    // products without minAge/maxAge.
    const ageBuckets: Array<{ label: string; matches: (p: ContextProduct) => boolean }> = [
      { label: '👶 عمر 0-3 سنوات',  matches: p => (p.minAge ?? 0) <= 3 && (p.maxAge ?? 0) >= 0 && (p.maxAge ?? 0) <= 5 },
      { label: '🧒 عمر 4-7 سنوات',  matches: p => (p.minAge ?? 99) <= 7 && (p.maxAge ?? 0) >= 4 },
      { label: '🧒 عمر 8-12 سنة',   matches: p => (p.minAge ?? 99) <= 12 && (p.maxAge ?? 0) >= 8 },
      { label: '👦 عمر 13+ سنة',    matches: p => (p.minAge ?? 0) >= 13 || (p.maxAge ?? 0) >= 13 },
    ];
    const noAge: ContextProduct[] = [];
    const ageHits = new Map<string, ContextProduct[]>();
    for (const p of products) {
      if (p.minAge === null || p.minAge === undefined) {
        noAge.push(p); continue;
      }
      let added = false;
      for (const b of ageBuckets) {
        if (b.matches(p)) {
          const arr = ageHits.get(b.label) ?? [];
          arr.push(p); ageHits.set(b.label, arr); added = true;
        }
      }
      if (!added) noAge.push(p);
    }

    for (const b of ageBuckets) {
      const list = ageHits.get(b.label);
      if (!list || list.length === 0) continue;
      lines.push(`\n**${b.label}:**`);
      for (const p of list.slice(0, 20)) lines.push(renderProductLine(p));
      if (list.length > 20) lines.push(`  ... و ${list.length - 20} منتج آخر في نفس الفئة العمرية`);
    }
    if (noAge.length > 0) {
      lines.push(`\n**📚 منتجات لكل الأعمار / غير محدد العمر:**`);
      // Inside this group, still split by category for readability.
      const byCategory = new Map<string, ContextProduct[]>();
      for (const p of noAge) {
        const list = byCategory.get(p.category) ?? [];
        list.push(p); byCategory.set(p.category, list);
      }
      for (const [cat, list] of byCategory) {
        lines.push(`\n*${cat}:*`);
        for (const p of list.slice(0, 20)) lines.push(renderProductLine(p));
        if (list.length > 20) lines.push(`  ... و ${list.length - 20} منتج آخر في نفس الفئة`);
      }
    }
    lines.push('');
  }

  // Books — include the BUY url (not just the reader page) so the
  // model can close the sale on a digital book in one link.
  if (books.length > 0) {
    lines.push(`### الكتب الرقمية (${books.length} كتاب) — اقترحها للأم اللي بتدوّر على هدية تربوية، كل كتاب فيه صفحات مجانية للتجربة قبل الشراء:`);
    for (const b of books.slice(0, 40)) {
      const free = b.freePages ? ` (${b.freePages} صفحة مجانية للمعاينة)` : '';
      const price = b.price ? `${Math.round(b.price)} ج.م` : 'مجاني';
      lines.push(`- ${b.title} | ${price}${free} | معاينة: https://moslimleader.com/library/${b.id} | شراء: https://moslimleader.com/library/${b.id}/buy`);
    }
    if (books.length > 40) lines.push(`... و ${books.length - 40} كتاب آخر`);
    lines.push('');
  }

  // Series — include the buy url too so a multi-book bundle can be
  // recommended in one click.
  if (seriesList.length > 0) {
    lines.push(`### السلاسل المتاحة (${seriesList.length}):`);
    for (const s of seriesList.slice(0, 20)) {
      const desc = s.description ? ` — ${s.description.slice(0, 100)}` : '';
      const price = s.seriesPrice ? Math.round(s.seriesPrice) + ' ج.م' : 'متاحة';
      lines.push(`- ${s.name}${desc} | ${price} | شراء: https://moslimleader.com/library/series/${s.id}/buy`);
    }
    lines.push('');
  }

  // Shipping rates — group by rate to keep it short.
  if (shipping.length > 0) {
    const byRate = new Map<number, string[]>();
    for (const s of shipping) {
      const list = byRate.get(s.rate) ?? [];
      list.push(s.governorateId);
      byRate.set(s.rate, list);
    }
    lines.push(`### أسعار الشحن داخل مصر:`);
    for (const [rate, govs] of Array.from(byRate.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(`- ${Math.round(rate)} ج.م: ${govs.join('، ')}`);
    }
    lines.push('- مدة الشحن: 2-5 أيام عمل');
    lines.push('');
  }

  // Active coupons.
  if (coupons.length > 0) {
    lines.push(`### كوبونات الخصم الحالية (لا تذكرها إلا إذا سأل العميل عنها):`);
    for (const c of coupons.slice(0, 5)) {
      const banner = c.showBanner ? ' [معروض على الموقع]' : '';
      lines.push(`- ${c.code}: خصم ${Math.round(c.discount)}%${banner}`);
    }
    lines.push('');
  }

  // Custom FAQs (admin-curated). Stored in Setting as a string
  // (markdown) so the owner can edit it freely from the admin page.
  let faqText = '';
  if (faqRow?.value) {
    faqText = typeof faqRow.value === 'string' ? faqRow.value : JSON.stringify(faqRow.value);
  }
  if (faqText.trim()) {
    lines.push(`### معلومات إضافية وأسئلة شائعة (من إدارة المتجر):`);
    lines.push(faqText);
    lines.push('');
  }

  // Default contact / policy footer.
  lines.push('### تواصل وروابط مهمة:');
  lines.push('- الموقع: https://moslimleader.com');
  lines.push('- المتجر: https://moslimleader.com/shop');
  lines.push('- المكتبة الرقمية: https://moslimleader.com/library');
  lines.push('- عن المتجر: https://moslimleader.com/about');
  lines.push('');

  lines.push('### قواعد إجابة لازم تلتزم بها:');
  lines.push('1. لو العميل سأل عن منتج، اذكر **اسمه الصحيح من القائمة أعلاه** + السعر + الرابط.');
  lines.push('2. لو السؤال عن سعر، اذكر السعر من القائمة بالضبط — لا تخمّن.');
  lines.push('3. لو السؤال عن منتج غير موجود في القائمة، قل: "مش متوفر حالياً، تقدري تتصفّحي المتجر للمنتجات المشابهة".');
  lines.push('4. لو السؤال عن شحن، اذكر سعر المحافظة من قائمة الشحن.');
  lines.push('5. لا تذكر منتج أو سعر مش موجود في الداتا أعلاه أبداً.');

  const text = lines.join('\n');

  const ctx: AssistantContext = {
    text,
    rawProducts: products.map(p => ({
      name: p.name,
      slug: p.slug,
      price: p.price,
      priceUsd: p.priceUsd,
    })),
    rawBooks: books.map(b => ({ title: b.title, id: b.id, price: b.price ?? 0 })),
    rawSeries: seriesList.map(s => ({ name: s.name, id: s.id, seriesPrice: s.seriesPrice ?? 0 })),
    stats: {
      productCount: products.length,
      bookCount: books.length,
      seriesCount: seriesList.length,
      shippingZoneCount: shipping.length,
      couponCount: coupons.length,
      faqCount: faqText.trim() ? faqText.split('\n').filter(l => l.trim().length > 0).length : 0,
      builtAt: new Date().toISOString(),
      approxChars: text.length,
    },
  };
  cache = { at: Date.now(), ctx };
  return ctx;
}

// Save admin-curated FAQ markdown.
export async function saveAssistantFaqs(text: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: 'assistant-faqs' },
    create: { key: 'assistant-faqs', value: text },
    update: { value: text },
  });
  invalidateAssistantContext();
}

export async function getAssistantFaqs(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: 'assistant-faqs' } });
  if (!row?.value) return '';
  return typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
}

export interface RawContextBook {
  title: string;
  id: string;
  price: number;
}

export interface RawContextSeries {
  name: string;
  id: string;
  seriesPrice: number;
}

// Build a localized price block for non-Egyptian users so the AI
// knows exactly what price to quote in the customer's local currency.
// Uses the same formula as geo-pricing.ts: priceUsd → local via usdRate.
export function buildLocalPriceBlock(
  rawProducts: RawContextProduct[],
  countryCode: string,
  rawBooks: RawContextBook[] = [],
  rawSeries: RawContextSeries[] = [],
): string {
  const zone = countryToZone(countryCode);

  // Egyptian customers: no extra block needed — the main context already
  // lists EGP prices and the AI defaults to them.
  if (zone === 'egypt') return '';

  const cc = COUNTRY_CURRENCIES[countryCode.toUpperCase()];
  const symbol = cc?.currency ?? '$';
  const usdRate = cc?.usdRate ?? 1;
  const countryName = cc?.nameAr ?? countryCode;

  const toLocal = (egp: number) => {
    const usd = egp / 50;
    const local = Math.round(usd * usdRate * 100) / 100;
    return local < 10 ? local.toFixed(2) : String(Math.round(local));
  };

  const lines: string[] = [];
  lines.push(`## ⚠️ تعليمة عملة العميل — أولوية قصوى:`);
  lines.push(`العميل من ${countryName}. يُحظر تمامًا ذكر أي سعر بالجنيه المصري (ج.م) في هذه المحادثة.`);
  lines.push(`استخدم الأسعار التالية بـ${symbol} فقط — هذه الأسعار الرسمية للمتجر لعملاء ${countryName}:`);

  if (rawProducts.length > 0) {
    lines.push(`### المنتجات:`);
    for (const p of rawProducts) {
      const usdPrice = (p.priceUsd && p.priceUsd > 0) ? p.priceUsd : p.price / 50;
      const localPrice = Math.round(usdPrice * usdRate * 100) / 100;
      const formatted = localPrice < 10 ? localPrice.toFixed(2) : String(Math.round(localPrice));
      lines.push(`- ${p.name}: ${formatted} ${symbol}`);
    }
  }

  if (rawBooks.length > 0) {
    lines.push(`### الكتب الرقمية:`);
    for (const b of rawBooks) {
      if (b.price > 0) lines.push(`- ${b.title}: ${toLocal(b.price)} ${symbol}`);
    }
  }

  if (rawSeries.length > 0) {
    lines.push(`### سلاسل الكتب:`);
    for (const s of rawSeries) {
      if (s.seriesPrice > 0) lines.push(`- ${s.name}: ${toLocal(s.seriesPrice)} ${symbol}`);
    }
  }

  return lines.join('\n');
}
