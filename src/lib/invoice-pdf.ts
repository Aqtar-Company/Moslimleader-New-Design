import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

interface InvoiceItem {
  productName: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  orderId: string;
  orderNumber: string;
  orderDate?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  couponCode?: string | null;
  shippingCost: number;
  total: number;
  currency: string;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    street?: string;
    building?: string;
    city?: string;
    region?: string;
    governorate?: string;
    country?: string;
  };
  notes?: string | null;
}

const PAY_LABELS: Record<string, string> = {
  cod: 'الدفع عند الاستلام',
  card: 'بطاقة ائتمان (PayPal)',
  paypal: 'PayPal',
  vodafone: 'Vodafone Cash',
  instapay: 'InstaPay',
};

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number, currency: string): string {
  return `${(Math.round(n * 100) / 100).toLocaleString('en-US')} ${currency}`;
}

function buildInvoiceHtml(data: InvoiceData): string {
  const date = data.orderDate || new Date().toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const addrParts = [
    data.shippingAddress.street,
    data.shippingAddress.building,
    data.shippingAddress.city,
    data.shippingAddress.region,
    data.shippingAddress.governorate,
    data.shippingAddress.country,
  ].filter(Boolean);
  const addressLine = esc(addrParts.join('، '));

  const itemRows = data.items.map(item => {
    const lineTotal = item.unitPrice * item.quantity;
    return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#1a1a2e;font-weight:600;">${esc(item.productName)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;color:#555;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:left;font-size:13px;color:#555;">${fmt(item.unitPrice, data.currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:left;font-size:13px;font-weight:700;color:#6B21A8;">${fmt(lineTotal, data.currency)}</td>
    </tr>`;
  }).join('');

  const discountRow = data.discount > 0 ? `
    <tr>
      <td colspan="3" style="padding:6px 12px;font-size:12px;color:#16a34a;">🎟️ خصم${data.couponCode ? ` (${esc(data.couponCode)})` : ''}</td>
      <td style="padding:6px 12px;text-align:left;font-size:12px;color:#16a34a;font-weight:700;">−${fmt(data.discount, data.currency)}</td>
    </tr>` : '';

  const shippingRow = `
    <tr>
      <td colspan="3" style="padding:6px 12px;font-size:12px;color:#555;">🚚 الشحن</td>
      <td style="padding:6px 12px;text-align:left;font-size:12px;color:#555;font-weight:600;">
        ${data.shippingCost > 0 ? fmt(data.shippingCost, data.currency) : '<span style="color:#16a34a">مجاني</span>'}
      </td>
    </tr>`;

  const notesSection = data.notes ? `
    <div style="margin-top:16px;background:#FFFBEB;border-right:4px solid #F5C518;border-radius:8px;padding:12px 16px;">
      <p style="margin:0 0 4px;font-size:10px;color:#92400E;font-weight:700;text-transform:uppercase;">📝 ملاحظات</p>
      <p style="margin:0;font-size:12px;color:#78350F;">${esc(data.notes)}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #fff; color: #1a1a2e; font-size: 13px; }
  .page { max-width: 794px; margin: 0 auto; padding: 32px; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #2d1060 100%); border-radius: 16px; padding: 28px 32px; text-align: center; margin-bottom: 24px; }
  .header img { height: 48px; margin-bottom: 10px; }
  .header .label { color: #F5C518; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .header .order-num { color: #fff; font-size: 26px; font-weight: 900; font-family: monospace; margin-top: 4px; }
  .meta-strip { background: #FFFBEB; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .meta-strip .date { font-size: 12px; color: #92400E; font-weight: 700; }
  .meta-strip .from { font-size: 11px; color: #78350F; }
  .section-title { font-size: 10px; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  table.items { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border: 1px solid #f3f4f6; margin-bottom: 4px; }
  table.items thead tr { background: #f9fafb; }
  table.items thead th { padding: 10px 12px; font-size: 11px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  table.items thead th:not(:first-child) { text-align: left; }
  table.totals { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .total-row td { padding: 14px 12px 6px; font-size: 16px; font-weight: 900; color: #1a1a2e; }
  .total-row td:last-child { text-align: left; font-size: 22px; }
  .divider { height: 2px; background: #e5e7eb; border-radius: 1px; margin: 8px 0; }
  .cards { display: flex; gap: 12px; margin: 20px 0; }
  .card { flex: 1; background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 14px 16px; }
  .card .card-title { font-size: 10px; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card .card-name { font-size: 14px; color: #1a1a2e; font-weight: 700; margin-bottom: 4px; }
  .card .card-detail { font-size: 11px; color: #6B7280; margin-bottom: 3px; }
  .pay-method { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .pay-value { font-size: 13px; color: #1a1a2e; font-weight: 700; }
  .footer { margin-top: 28px; background: linear-gradient(135deg, #1a1a2e 0%, #2d1060 100%); border-radius: 12px; padding: 16px 24px; text-align: center; }
  .footer p { color: rgba(255,255,255,0.45); font-size: 11px; margin-bottom: 4px; }
  .footer .thanks { color: #F5C518; font-size: 12px; font-weight: 700; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <img src="https://moslimleader.com/white-Logo.webp" alt="Moslim Leader" />
    <div class="label">فاتورة الطلب</div>
    <div class="order-num">#${esc(data.orderNumber)}</div>
  </div>

  <!-- Meta -->
  <div class="meta-strip">
    <span class="date">📅 ${date}</span>
    <span class="from">من: <strong>${esc(data.customerName)}</strong></span>
  </div>

  <!-- Items -->
  <p class="section-title">🛒 المنتجات (${data.items.length})</p>
  <table class="items">
    <thead>
      <tr>
        <th>المنتج</th>
        <th>الكمية</th>
        <th>سعر الوحدة</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <table class="totals">
    <tr>
      <td colspan="3" style="padding:8px 12px;font-size:13px;color:#555;">المجموع الفرعي</td>
      <td style="padding:8px 12px;text-align:left;font-size:13px;font-weight:600;color:#333;">${fmt(data.subtotal, data.currency)}</td>
    </tr>
    ${discountRow}
    ${shippingRow}
    <tr><td colspan="4" style="padding:0 12px;"><div class="divider"></div></td></tr>
    <tr class="total-row">
      <td colspan="3">💰 الإجمالي</td>
      <td>${fmt(data.total, data.currency)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:6px 12px;" class="pay-method">وسيلة الدفع</td>
      <td colspan="2" style="padding:6px 12px;text-align:left;" class="pay-value">
        ${esc(PAY_LABELS[data.paymentMethod] || data.paymentMethod)}
      </td>
    </tr>
  </table>

  <!-- Customer + Address cards -->
  <div class="cards">
    <div class="card">
      <div class="card-title">👤 بيانات العميل</div>
      <div class="card-name">${esc(data.customerName)}</div>
      <div class="card-detail">📧 ${esc(data.customerEmail)}</div>
      <div class="card-detail" dir="ltr">📱 ${esc(data.customerPhone)}</div>
    </div>
    <div class="card">
      <div class="card-title">📍 عنوان الشحن</div>
      <div class="card-detail" style="font-size:12px;line-height:1.6;">${addressLine || '—'}</div>
    </div>
  </div>

  ${notesSection}

  <!-- Footer -->
  <div class="footer">
    <p>moslimleader.com — نظام إدارة الطلبات</p>
    <p class="thanks">جزاك الله خيرًا 🤍</p>
  </div>

</div>
</body>
</html>`;
}

/**
 * Generate a PDF buffer from the invoice HTML using wkhtmltopdf (if available)
 * or falls back to returning null (so email still sends without attachment).
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer | null> {
  const html = buildInvoiceHtml(data);
  const tmpHtml = join(tmpdir(), `invoice_${data.orderNumber}_${Date.now()}.html`);
  const tmpPdf = join(tmpdir(), `invoice_${data.orderNumber}_${Date.now()}.pdf`);

  try {
    // Try wkhtmltopdf first (fast, no browser needed)
    await writeFile(tmpHtml, html, 'utf8');

    // Check if wkhtmltopdf is available
    try {
      await execAsync(`which wkhtmltopdf`);
      await execAsync(
        `wkhtmltopdf --quiet --encoding utf-8 --page-size A4 --margin-top 0 --margin-bottom 0 --margin-left 0 --margin-right 0 --enable-local-file-access "${tmpHtml}" "${tmpPdf}"`
      );
      const pdfBuffer = await readFile(tmpPdf);
      return pdfBuffer;
    } catch {
      // wkhtmltopdf not available, try puppeteer
    }

    // Try puppeteer-core if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const puppeteer = require('puppeteer-core');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const chromium = require('@sparticuz/chromium');
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      return Buffer.from(pdf);
    } catch {
      // puppeteer not available either
    }

    return null;
  } catch (err) {
    console.error('[invoice-pdf] generation failed', err);
    return null;
  } finally {
    // Cleanup temp files
    try { await unlink(tmpHtml); } catch { /* ignore */ }
    try { await unlink(tmpPdf); } catch { /* ignore */ }
  }
}

export { buildInvoiceHtml, type InvoiceData };
