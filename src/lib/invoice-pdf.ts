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

// Load logo as base64 so wkhtmltopdf doesn't need external HTTP requests.
// Falls back to empty string (no logo shown) if file is missing.
async function getLogoDataUri(): Promise<string> {
  try {
    const logoPath = join(process.cwd(), 'public', 'ml-logo-new.png');
    const buf = await readFile(logoPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function buildInvoiceHtml(data: InvoiceData, logoDataUri: string): string {
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
      <td class="td-product">${esc(item.productName)}</td>
      <td class="td-center">${item.quantity}</td>
      <td class="td-num">${fmt(item.unitPrice, data.currency)}</td>
      <td class="td-total">${fmt(lineTotal, data.currency)}</td>
    </tr>`;
  }).join('');

  const discountRow = data.discount > 0 ? `
    <tr>
      <td colspan="3" class="td-sub-label">خصم${data.couponCode ? ` (${esc(data.couponCode)})` : ''}</td>
      <td class="td-sub-val td-green">-${fmt(data.discount, data.currency)}</td>
    </tr>` : '';

  const shippingRow = `
    <tr>
      <td colspan="3" class="td-sub-label">الشحن</td>
      <td class="td-sub-val">${data.shippingCost > 0 ? fmt(data.shippingCost, data.currency) : '<span class="td-green">مجاني</span>'}</td>
    </tr>`;

  const notesSection = data.notes ? `
    <div class="notes-box">
      <p class="notes-label">ملاحظات</p>
      <p class="notes-text">${esc(data.notes)}</p>
    </div>` : '';

  const logoImg = logoDataUri
    ? `<img src="${logoDataUri}" alt="Moslim Leader" class="logo" />`
    : `<p class="brand-text">مسلم ليدر</p>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    direction: rtl;
    background: #ffffff;
    color: #1a1a2e;
    font-size: 13px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 794px; margin: 0 auto; padding: 28px 32px; }

  /* ── Header ── */
  .header {
    background: #1a1a2e;
    border-radius: 14px;
    padding: 24px 28px 20px;
    text-align: center;
    margin-bottom: 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .logo { height: 44px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
  .brand-text { color: #F5C518; font-size: 20px; font-weight: 900; margin-bottom: 8px; }
  .header-label {
    color: #F5C518;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .order-num {
    color: #ffffff;
    font-size: 24px;
    font-weight: 900;
    font-family: 'Courier New', monospace;
    letter-spacing: 1px;
  }

  /* ── Meta strip ── */
  .meta-strip {
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-radius: 10px;
    padding: 10px 18px;
    margin-bottom: 18px;
    display: table;
    width: 100%;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .meta-date { display: table-cell; font-size: 12px; color: #92400E; font-weight: 700; }
  .meta-from { display: table-cell; text-align: left; font-size: 11px; color: #78350F; }

  /* ── Section title ── */
  .section-title {
    font-size: 10px; color: #9ca3af; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
  }

  /* ── Items table ── */
  table.items {
    width: 100%; border-collapse: collapse;
    border: 1px solid #e5e7eb; border-radius: 10px;
    margin-bottom: 4px; overflow: hidden;
  }
  table.items thead tr {
    background: #f3f4f6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table.items thead th {
    padding: 9px 12px; font-size: 10px; color: #6B7280;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  table.items thead th:not(:first-child) { text-align: left; }
  .td-product { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #1a1a2e; font-weight: 600; }
  .td-center   { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; text-align: center; font-size: 13px; color: #555; }
  .td-num      { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; text-align: left; font-size: 13px; color: #555; }
  .td-total    { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; text-align: left; font-size: 13px; font-weight: 700; color: #6B21A8; }

  /* ── Totals ── */
  table.totals { width: 100%; border-collapse: collapse; margin-top: 2px; }
  .td-sub-label { padding: 6px 12px; font-size: 12px; color: #555; }
  .td-sub-val   { padding: 6px 12px; text-align: left; font-size: 12px; color: #555; font-weight: 600; }
  .td-green { color: #16a34a !important; }
  .divider { height: 1px; background: #e5e7eb; margin: 6px 0; }
  .total-label { padding: 10px 12px; font-size: 16px; font-weight: 900; color: #1a1a2e; }
  .total-val   { padding: 10px 12px; text-align: left; font-size: 22px; font-weight: 900; color: #1a1a2e; }
  .pay-label { padding: 4px 12px; font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .pay-val   { padding: 4px 12px; text-align: left; font-size: 13px; color: #1a1a2e; font-weight: 700; }

  /* ── Customer + Address cards ── */
  .cards { display: table; width: 100%; margin: 18px 0; border-spacing: 10px; border-collapse: separate; }
  .card {
    display: table-cell; width: 50%;
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 12px; padding: 14px 16px; vertical-align: top;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .card-title { font-size: 10px; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card-name   { font-size: 14px; color: #1a1a2e; font-weight: 700; margin-bottom: 4px; }
  .card-detail { font-size: 11px; color: #6B7280; margin-bottom: 3px; }

  /* ── Notes ── */
  .notes-box {
    background: #FFFBEB; border-right: 4px solid #F5C518;
    border-radius: 8px; padding: 10px 14px; margin-top: 14px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .notes-label { font-size: 10px; color: #92400E; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
  .notes-text  { font-size: 12px; color: #78350F; }

  /* ── Footer ── */
  .footer {
    margin-top: 24px;
    background: #1a1a2e;
    border-radius: 12px;
    padding: 14px 24px;
    text-align: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .footer-site  { color: rgba(255,255,255,0.4); font-size: 10px; margin-bottom: 4px; }
  .footer-thanks { color: #F5C518; font-size: 12px; font-weight: 700; }

  /* ── Accent bar under header ── */
  .accent-bar {
    height: 4px;
    background: #F5C518;
    border-radius: 2px;
    margin-bottom: 20px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    ${logoImg}
    <div class="header-label">فاتورة الطلب</div>
    <div class="order-num">#${esc(data.orderNumber)}</div>
  </div>

  <!-- Accent bar -->
  <div class="accent-bar"></div>

  <!-- Meta -->
  <div class="meta-strip">
    <span class="meta-date">&#128197; ${date}</span>
    <span class="meta-from">من: <strong>${esc(data.customerName)}</strong></span>
  </div>

  <!-- Items -->
  <p class="section-title">المنتجات (${data.items.length})</p>
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
      <td colspan="3" class="td-sub-label">المجموع الفرعي</td>
      <td class="td-sub-val">${fmt(data.subtotal, data.currency)}</td>
    </tr>
    ${discountRow}
    ${shippingRow}
    <tr><td colspan="4"><div class="divider"></div></td></tr>
    <tr>
      <td colspan="3" class="total-label">الإجمالي</td>
      <td class="total-val">${fmt(data.total, data.currency)}</td>
    </tr>
    <tr>
      <td colspan="2" class="pay-label">وسيلة الدفع</td>
      <td colspan="2" class="pay-val">${esc(PAY_LABELS[data.paymentMethod] || data.paymentMethod)}</td>
    </tr>
  </table>

  <!-- Customer + Address -->
  <table class="cards">
    <tr>
      <td class="card">
        <div class="card-title">بيانات العميل</div>
        <div class="card-name">${esc(data.customerName)}</div>
        <div class="card-detail">${esc(data.customerEmail)}</div>
        <div class="card-detail" dir="ltr">${esc(data.customerPhone)}</div>
      </td>
      <td class="card">
        <div class="card-title">عنوان الشحن</div>
        <div class="card-detail" style="font-size:12px;line-height:1.7;">${addressLine || '—'}</div>
      </td>
    </tr>
  </table>

  ${notesSection}

  <!-- Footer -->
  <div class="footer">
    <p class="footer-site">moslimleader.com</p>
    <p class="footer-thanks">جزاك الله خيرًا</p>
  </div>

</div>
</body>
</html>`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer | null> {
  const logoDataUri = await getLogoDataUri();
  const html = buildInvoiceHtml(data, logoDataUri);
  const tmpHtml = join(tmpdir(), `invoice_${data.orderNumber}_${Date.now()}.html`);
  const tmpPdf  = join(tmpdir(), `invoice_${data.orderNumber}_${Date.now()}.pdf`);

  try {
    await writeFile(tmpHtml, html, 'utf8');

    // wkhtmltopdf — best results on this server (CentOS/RHEL)
    try {
      await execAsync(`which wkhtmltopdf`);
      await execAsync(
        `wkhtmltopdf --quiet --encoding utf-8 --page-size A4 ` +
        `--margin-top 0 --margin-bottom 0 --margin-left 0 --margin-right 0 ` +
        `--background --no-stop-slow-scripts --javascript-delay 200 ` +
        `--enable-local-file-access ` +
        `"${tmpHtml}" "${tmpPdf}"`
      );
      const pdfBuffer = await readFile(tmpPdf);
      return pdfBuffer;
    } catch {
      // wkhtmltopdf not available
    }

    // Puppeteer fallback
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
      // puppeteer not available
    }

    return null;
  } catch (err) {
    console.error('[invoice-pdf] generation failed', err);
    return null;
  } finally {
    try { await unlink(tmpHtml); } catch { /* ignore */ }
    try { await unlink(tmpPdf); } catch { /* ignore */ }
  }
}

export { buildInvoiceHtml, type InvoiceData };
