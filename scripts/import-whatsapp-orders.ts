/* eslint-disable no-console */
/**
 * WhatsApp historical orders importer.
 *
 * Usage:
 *   npx tsx scripts/import-whatsapp-orders.ts --dry-run
 *   npx tsx scripts/import-whatsapp-orders.ts            # live run
 *   npx tsx scripts/import-whatsapp-orders.ts --file=data/whatsapp-orders-ready.json
 *
 * Idempotent: every order has external_order_id (ML-WA-N) which is enforced
 * unique on Order.externalOrderId. Re-running the script skips already-imported
 * orders and only fills in newly-added ones.
 *
 * Customers: matched by normalized phone (`normalizeEgyptPhone`). Existing
 * customers have their missing fields (name, phone) filled in but never
 * overwritten with import data.
 *
 * Products: matched by Arabic name against the static catalogue in
 * src/lib/products.ts via PRODUCT_ALIASES below. Unmatched product names
 * are reported, never auto-created.
 *
 * Stock: this importer does NOT touch stock or write StockMovement rows
 * — these are historical pre-stock-system orders.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { prisma } from '../src/lib/prisma';
import { products as staticProducts } from '../src/lib/products';
import { normalizeEgyptPhone } from '../src/lib/phone';

interface ImportCustomer {
  name: string;
  phone: string;
  whatsapp?: string | null;
  extra_phones?: string | null;
  city_or_governorate?: string | null;
  address?: string | null;
}
interface ImportItem {
  line_id: number;
  product_name: string;
  quantity: number;
  unit_price_estimated: number | null;
  line_total_estimated: number | null;
  raw_product_text?: string;
}
interface ImportOrder {
  external_order_id: string;
  source_row: number;
  order_date: string;
  order_time: string;
  customer: ImportCustomer;
  items: ImportItem[];
  products_summary: string;
  amount_total_or_paid: number;
  shipping_cost: number | null;
  payment_method: string | null;
  status: string;
  notes: string | null;
}
interface ImportPayload {
  source: string;
  source_file?: string;
  counts?: { orders?: number; line_items?: number; customers?: number };
  customers: ImportCustomer[];
  orders: ImportOrder[];
}

// Static product name → product id. Keys are normalised on-the-fly so we
// also catch minor variants (with/without ـ "كتاب", with "ال" prefix, etc.).
// Unknown raw names get logged to the report instead of auto-created.
const PRODUCT_ALIASES: Record<string, string> = {
  'كتاب فلسطين في عيون أبنائي': '8',
  'كتاب فلسطين في عيون ابنائي': '8',
  'فلسطين في عيون ابنائي': '8',
  'فلسطين': '8',
  'كتاب إلى ابني وأستاذي الشاب': '9',
  'كتاب الى ابني واستاذي الشاب': '9',
  'الى ابني واستاذي الشاب': '9',
  'إلى ابني وأستاذي الشاب': '9',
  'كتاب رسائل أمهات العظماء': '10',
  'كتاب رسائل امهات العظماء': '10',
  'رسائل أمهات العظماء': '10',
  'رسائل امهات العظماء': '10',
  'أمهات العظماء': '10',
  'امهات العظماء': '10',
  'عظماء': '10',
  'امهات': '10',
  'رواية البخاري على كوكب المريخ': '11',
  'البخاري على كوكب المريخ': '11',
  'البخاري علي كوكب المريخ': '11',
  'روايه البخاري': '11',
  'البخاري': '11',
  'كتاب فقيه في بلاد العجائب': '12',
  'فقيه في بلاد العجائب': '12',
  'فقيه': '12',
  'قصة الصلاة': '13',
  'قصه الصلاه': '13',
  'مجموعة قصص الصلاة': '13',
  'مجموعه قصص الصلاه': '13',
  'قصص الصلاه': '13',
  'سلسلة ابني يسأل': '14',
  'مجموعة ابني يسأل': '14',
  'مجموعه ابني يسال': '14',
  'ابني يسال': '14',
  'ابني يسأل': '14',
  'مسلسل البر': '15',
  'مجموعة مسلسل البر': '15',
  'مفكرة أطفال': '16',
  'مفكره اطفال': '16',
  'مفكرة صغار بنات': '16:girls',
  'مفكره صغار بنات': '16:girls',
  'مفكره بنت': '16:girls',
  'مفكرة صغار أولاد': '16:boys',
  'مفكره صغار اولاد': '16:boys',
  'مفكره صغار ولد': '16:boys',
  'مفكره اولاد': '16:boys',
  'مفكرة كبار': '17',
  'مفكرة كبار نساء': '17:women',
  'مفكره نساء': '17:women',
  'مفكره بنات كبار': '17:women',
  'مفكره كبار رجال': '17:men',
  'مفكره رجال': '17:men',
  'شنطة مسلم ليدر': '18',
  'شنطة بناتي': '18:girls',
  'شنطه بناتي': '18:girls',
  'شنطة أولادي': '18:boys',
  'شنطه اولادي': '18:boys',
  'شنطه ولد': '18:boys',
  'شنطه ولد بنضاره': '18:boys',
  'ماسك': '19',
  'حامل المصحف': '19',
  'مج مخصص': '20',
  'مج': '20',
  'مجات': '20',
  'دبوس': '23',
  'دبوس مسلم ليدر': '23',
  'دبوس أولادي': '23',
  'دبوس اولادي': '23',
  'دبوس ولد': '23',
  'دبوس بناتي': '23',
  'كروت قادة وأئمة المسلمين': '3',
  'إعداد القادة': '3',
  'اعداد القاده': '3',
  'القاده': '3',
  'قاده وائمه المسلمين': '3',
  'كروت قاده': '3',
  'وسام القائد': '2',
  'تكوين أولاد': '5',
  'تكوين اولاد': '5',
  'بازل تكوين أولاد': '5',
  'بازل تكوين اولاد': '5',
  'تكوين بنات': '6',
  'بازل تكوين بنات': '6',
  'تكوين للبنات': '6',
  'ألواح': '7',
  'الواح': '7',
  'الواح جزء عم': '7',
  'لعبة يوم الصائم': '1',
  'لعبه يوم الصائم': '1',
  'يوم الصائم': '1',
  'الصائم': '1',
  'لعبة/كتاب يوم الصائم': '1',
  'لعبة الصلاة وقصة الحج': '4',
  'لعبة تعليم الحج والصلاة': '4',
  'لعبه تعليم الحج والصلاه': '4',
  'تعليم الحج والصلاه': '4',
  'لعبه الحج والصلاه': '4',
  'حج وصلاه خشب': '4',
  'تعليم الحج والصلاة': '4',
};

// Variant name → variant index per product, derived from src/lib/products.ts.
const VARIANT_INDEX: Record<string, Record<string, number>> = {
  '16': { boys: 0, girls: 1 },
  '17': { men: 0, women: 1 },
  '18': { boys: 0, girls: 1 },
};

function normaliseArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '') // diacritics
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[\.,،;؛:!?\-_/\\()\[\]"'…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const aliasIndex = new Map<string, string>();
for (const [k, v] of Object.entries(PRODUCT_ALIASES)) {
  aliasIndex.set(normaliseArabic(k), v);
}

function matchProduct(rawName: string): { productId: string; variantIndex: number | null } | null {
  const norm = normaliseArabic(rawName);
  // Direct alias hit.
  const direct = aliasIndex.get(norm);
  if (direct) return parseAlias(direct);
  // Substring fallback: any alias whose normalised form is contained inside the raw name.
  for (const [k, v] of aliasIndex.entries()) {
    if (k.length >= 3 && norm.includes(k)) return parseAlias(v);
  }
  return null;
}

function parseAlias(alias: string): { productId: string; variantIndex: number | null } {
  const [pid, variantKey] = alias.split(':');
  const variantIndex = variantKey && VARIANT_INDEX[pid] ? VARIANT_INDEX[pid][variantKey] ?? null : null;
  return { productId: pid, variantIndex };
}

const CLI_FLAGS = process.argv.slice(2);
const DRY = CLI_FLAGS.includes('--dry-run') || CLI_FLAGS.includes('-n');
const fileFlag = CLI_FLAGS.find(f => f.startsWith('--file='));
const FILE = fileFlag ? fileFlag.slice('--file='.length) : 'data/whatsapp-orders-ready.json';

interface Report {
  customers: { created: number; updated: number; matched: number };
  orders: { created: number; skipped_existing: number; skipped_no_items: number };
  items: { created: number; unmatched: number };
  unmatchedProducts: Map<string, number>;
  unmatchedDetails: Array<{ external_order_id: string; raw: string }>;
  errors: Array<{ external_order_id: string; error: string }>;
}

async function run() {
  const path = resolve(process.cwd(), FILE);
  const raw = readFileSync(path, 'utf8');
  let payload: ImportPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error(`✗ Cannot parse JSON at ${path}`);
    process.exit(2);
  }
  if (!Array.isArray(payload.orders) || !Array.isArray(payload.customers)) {
    console.error(`✗ Payload at ${path} is missing customers[] or orders[]`);
    process.exit(2);
  }

  console.log(`\n${DRY ? '🔎 DRY RUN' : '🚀 LIVE'} — importing from ${FILE}`);
  console.log(`   Source: ${payload.source ?? '(unknown)'}  •  Source file: ${payload.source_file ?? '-'}`);
  console.log(`   Orders: ${payload.orders.length}  •  Customers: ${payload.customers.length}\n`);

  // Pre-seed all referenced static products in DB so OrderItem.productId FK
  // works on the live run. Static products only — admin-created products
  // are already in the DB.
  const referencedProductIds = new Set<string>();
  for (const o of payload.orders) {
    for (const it of o.items) {
      const m = matchProduct(it.product_name) || matchProduct(it.raw_product_text || '');
      if (m) referencedProductIds.add(m.productId);
    }
  }
  if (!DRY) {
    for (const pid of referencedProductIds) {
      const sp = staticProducts.find(p => p.id === pid);
      if (!sp) continue;
      await prisma.product.upsert({
        where: { slug: sp.slug },
        create: {
          id: sp.id,
          slug: sp.slug,
          name: sp.name,
          nameEn: sp.nameEn,
          shortDescription: sp.shortDescription,
          shortDescriptionEn: sp.shortDescriptionEn,
          description: sp.description,
          descriptionEn: sp.descriptionEn,
          price: sp.price,
          category: sp.category,
          subcategory: sp.subcategory,
          variants: (sp.variants ?? []) as object[],
          tags: sp.tags as string[],
          images: sp.images as string[],
          inStock: sp.inStock,
          featured: sp.featured ?? false,
          videos: sp.videos ?? [],
          weight: sp.weight,
          source: 'static',
        },
        update: {},
      });
    }
  }

  const report: Report = {
    customers: { created: 0, updated: 0, matched: 0 },
    orders: { created: 0, skipped_existing: 0, skipped_no_items: 0 },
    items: { created: 0, unmatched: 0 },
    unmatchedProducts: new Map(),
    unmatchedDetails: [],
    errors: [],
  };

  for (const order of payload.orders) {
    try {
      // Idempotency check.
      const existing = await prisma.order.findUnique({
        where: { externalOrderId: order.external_order_id },
        select: { id: true },
      });
      if (existing) {
        report.orders.skipped_existing++;
        continue;
      }

      // Resolve user — by phone first.
      const phone = normalizeEgyptPhone(order.customer.phone) || order.customer.phone?.trim() || null;
      const altPhone = normalizeEgyptPhone(order.customer.whatsapp || order.customer.extra_phones || '') || null;

      // Resolve products + per-line variant.
      const lines: Array<{
        productId: string;
        productName: string;
        productImage: string | null;
        quantity: number;
        unitPrice: number;
        selectedModel: number | null;
      }> = [];
      for (const it of order.items) {
        const matched = matchProduct(it.product_name) || matchProduct(it.raw_product_text || '');
        if (!matched) {
          report.unmatchedProducts.set(it.product_name, (report.unmatchedProducts.get(it.product_name) ?? 0) + 1);
          report.unmatchedDetails.push({ external_order_id: order.external_order_id, raw: it.product_name });
          report.items.unmatched++;
          continue;
        }
        const sp = staticProducts.find(p => p.id === matched.productId);
        const productName = sp?.name || it.product_name;
        const productImage = sp && Array.isArray(sp.images) && sp.images.length > 0
          ? (typeof sp.images[0] === 'string' ? (sp.images[0] as string) : null)
          : null;
        const qty = Math.max(1, Math.floor(it.quantity || 1));
        // Estimated price split: if a per-line total is present use it; else
        // distribute order total across lines proportional to qty.
        const unitPrice = it.unit_price_estimated ?? (it.line_total_estimated ? it.line_total_estimated / qty : 0);
        lines.push({
          productId: matched.productId,
          productName,
          productImage,
          quantity: qty,
          unitPrice,
          selectedModel: matched.variantIndex,
        });
      }
      if (lines.length === 0) {
        report.orders.skipped_no_items++;
        continue;
      }

      const total = order.amount_total_or_paid ?? 0;
      const shippingCost = order.shipping_cost ?? 0;
      // Subtotal must reflect the legacy total (which already includes shipping).
      // We split total = subtotal + shipping where shipping is the known number.
      const subtotal = Math.max(0, total - (shippingCost || 0));
      // Re-scale unit prices so sum matches subtotal when totals are present and lines lack prices.
      const linesSum = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      if (subtotal > 0 && linesSum === 0) {
        const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
        const perUnit = subtotal / totalQty;
        for (const l of lines) l.unitPrice = perUnit;
      } else if (subtotal > 0 && Math.abs(linesSum - subtotal) > 1) {
        const factor = subtotal / linesSum;
        for (const l of lines) l.unitPrice = l.unitPrice * factor;
      }

      const shippingAddress = {
        firstName: order.customer.name?.trim().split(/\s+/)[0] || '',
        lastName: order.customer.name?.trim().split(/\s+/).slice(1).join(' ') || '',
        phone: phone || '',
        whatsappNumber: altPhone || '',
        email: '',
        street: order.customer.address || '',
        building: '',
        city: '',
        region: '',
        governorate: order.customer.city_or_governorate || '',
        country: 'EG',
        notes: order.notes || '',
      };

      const composedNotes = [
        order.notes,
        `[Source: whatsapp_cleaned_ready · row ${order.source_row}]`,
        `[Products: ${order.products_summary}]`,
      ].filter(Boolean).join(' · ') || null;

      const orderDate = order.order_date ? new Date(order.order_date) : new Date();
      const paymentMethod = order.payment_method?.includes('إنستاباي') ? 'instapay'
        : order.payment_method?.includes('تحويل') ? 'bank'
        : order.payment_method?.includes('هدية') ? 'gift'
        : 'cod';

      if (DRY) {
        report.orders.created++;
        report.items.created += lines.length;
        // Synthetic counter: count distinct customers we'd touch.
        // Defer the actual "created vs updated" decision to live mode.
        continue;
      }

      // ------- LIVE PATH -------
      // 1. Find or create user. Match by phone, then by whatsapp/alt phone.
      let user = phone
        ? await prisma.user.findFirst({ where: { phone } })
        : null;
      if (!user && altPhone) user = await prisma.user.findFirst({ where: { phone: altPhone } });
      let createdNewUser = false;
      if (!user) {
        const syntheticEmail = `wa-${phone || altPhone || randomBytes(6).toString('hex')}@imported.local`;
        user = await prisma.user.create({
          data: {
            name: order.customer.name?.trim() || 'WhatsApp Customer',
            email: syntheticEmail,
            passwordHash: randomBytes(32).toString('hex'),
            phone: phone || null,
            emailVerified: false,
            marketingOptIn: false,
            role: 'customer',
          },
        }).catch(async () => {
          // Email collision (rare): fetch and continue.
          return await prisma.user.findUnique({ where: { email: syntheticEmail } });
        });
        if (!user) throw new Error('cannot create or fetch user');
        createdNewUser = true;
      } else {
        // Fill in missing fields without overwriting.
        const patch: { name?: string; phone?: string } = {};
        if ((!user.name || /^WhatsApp Customer$/i.test(user.name)) && order.customer.name) patch.name = order.customer.name.trim();
        if (!user.phone && phone) patch.phone = phone;
        if (Object.keys(patch).length > 0) {
          await prisma.user.update({ where: { id: user.id }, data: patch });
          report.customers.updated++;
        } else {
          report.customers.matched++;
        }
      }
      if (createdNewUser) report.customers.created++;

      // 2. Create order + items inside a single transaction.
      await prisma.$transaction(async tx => {
        await tx.order.create({
          data: {
            userId: user!.id,
            status: 'delivered',  // historical orders — they shipped years ago
            total,
            shippingCost: shippingCost || 0,
            discount: 0,
            paymentMethod,
            shippingAddress: shippingAddress as unknown as object,
            notes: composedNotes,
            currency: 'EGP',
            externalOrderId: order.external_order_id,
            source: 'whatsapp_cleaned_ready',
            createdAt: orderDate,
            items: {
              create: lines.map(l => ({
                productId: l.productId,
                productName: l.productName,
                productImage: l.productImage,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                selectedModel: l.selectedModel,
              })),
            },
          },
        });
      });
      report.orders.created++;
      report.items.created += lines.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.errors.push({ external_order_id: order.external_order_id, error: message });
      console.error(`✗ ${order.external_order_id}: ${message}`);
    }
  }

  // -------- Print final report --------
  console.log('\n=== Import report ===');
  console.log(`Mode:         ${DRY ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Orders:       created=${report.orders.created}  skipped(existing)=${report.orders.skipped_existing}  skipped(no items)=${report.orders.skipped_no_items}`);
  console.log(`Items:        created=${report.items.created}  unmatched=${report.items.unmatched}`);
  if (!DRY) {
    console.log(`Customers:    created=${report.customers.created}  updated=${report.customers.updated}  matched=${report.customers.matched}`);
  }
  if (report.unmatchedProducts.size > 0) {
    console.log('\nUnmatched product names (review and add aliases if needed):');
    const sorted = Array.from(report.unmatchedProducts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) console.log(`   ${count}× "${name}"`);
  }
  if (report.errors.length > 0) {
    console.log('\nErrors:');
    for (const e of report.errors.slice(0, 10)) console.log(`   ${e.external_order_id}: ${e.error}`);
    if (report.errors.length > 10) console.log(`   …and ${report.errors.length - 10} more`);
  }
  console.log('');

  await prisma.$disconnect();
  if (report.errors.length > 0) process.exit(1);
}

run().catch(async err => {
  console.error('FATAL:', err);
  await prisma.$disconnect();
  process.exit(1);
});
