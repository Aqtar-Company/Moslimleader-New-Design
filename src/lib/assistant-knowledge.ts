import { prisma } from './prisma';
import { products as staticProducts } from './products';
import { applyOverride, loadStaticOverrides } from './product-overrides';
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

export interface AssistantContext {
  /** The text block injected into the system prompt. Arabic, ~3K tokens max. */
  text: string;
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
        id: true, slug: true, name: true, nameEn: true, price: true,
        category: true, source: true, shortDescription: true,
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
  let products: Array<Pick<Product, 'name' | 'slug' | 'category' | 'price'> & { shortDescription?: string }> = [];
  try {
    const overrides = await loadStaticOverrides();
    products = dbProducts.map(p => {
      if (p.source === 'static') {
        const merged = applyOverride(p as unknown as Product, overrides[p.id]);
        return merged ?? p;
      }
      return p;
    }) as typeof products;
  } catch {
    products = dbProducts as typeof products;
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
    const byCategory = new Map<string, typeof products>();
    for (const p of products) {
      const list = byCategory.get(p.category) ?? [];
      list.push(p);
      byCategory.set(p.category, list);
    }
    for (const [cat, list] of byCategory) {
      lines.push(`\n**${cat}:**`);
      for (const p of list.slice(0, 30)) {
        const short = p.shortDescription ? ` — ${p.shortDescription.slice(0, 80)}` : '';
        lines.push(`- ${p.name}${short} | ${Math.round(p.price)} ج.م | https://moslimleader.com/shop/${p.slug}`);
      }
      if (list.length > 30) lines.push(`  ... و ${list.length - 30} منتج آخر في نفس الفئة`);
    }
    lines.push('');
  }

  // Books.
  if (books.length > 0) {
    lines.push(`### الكتب الرقمية (${books.length} كتاب):`);
    for (const b of books.slice(0, 40)) {
      const free = b.freePages ? ` (${b.freePages} صفحة مجانية للمعاينة)` : '';
      const price = b.price ? `${Math.round(b.price)} ج.م` : 'مجاني';
      lines.push(`- ${b.title} | ${price}${free} | https://moslimleader.com/library/${b.id}`);
    }
    if (books.length > 40) lines.push(`... و ${books.length - 40} كتاب آخر`);
    lines.push('');
  }

  // Series.
  if (seriesList.length > 0) {
    lines.push(`### السلاسل المتاحة (${seriesList.length}):`);
    for (const s of seriesList.slice(0, 20)) {
      const desc = s.description ? ` — ${s.description.slice(0, 100)}` : '';
      lines.push(`- ${s.name}${desc} | ${s.seriesPrice ? Math.round(s.seriesPrice) + ' ج.م' : 'متاحة'}`);
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
