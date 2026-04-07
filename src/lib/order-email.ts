import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

interface OrderEmailItem {
  productName: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
}

interface OrderEmailData {
  orderId: string;
  orderNumber: string;
  items: OrderEmailItem[];
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

const PAY_METHOD_LABELS: Record<string, string> = {
  cod: 'الدفع عند الاستلام',
  card: 'بطاقة بنكية',
  paypal: 'PayPal',
  vodafone: 'Vodafone Cash',
  instapay: 'InstaPay',
};

function formatPrice(n: number, currency: string) {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded.toLocaleString('en-US')} ${currency}`;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAddressLine(addr: OrderEmailData['shippingAddress']): string {
  const parts = [
    addr.street,
    addr.building,
    addr.city,
    addr.region,
    addr.governorate,
    addr.country,
  ].filter(Boolean);
  return escapeHtml(parts.join('، '));
}

export function buildOrderEmailHtml(data: OrderEmailData): string {
  const orderDate = new Date().toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const payLabel = PAY_METHOD_LABELS[data.paymentMethod] || data.paymentMethod;
  const addressLine = buildAddressLine(data.shippingAddress);

  const itemsRows = data.items
    .map(item => {
      const lineTotal = item.unitPrice * item.quantity;
      const imgSrc = item.productImage && item.productImage.startsWith('http')
        ? item.productImage
        : item.productImage
          ? `https://moslimleader.com${item.productImage}`
          : 'https://moslimleader.com/white-Logo.webp';
      return `
        <tr>
          <td style="padding:14px 12px;border-bottom:1px solid #f0f0f0;vertical-align:middle;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.productName)}" width="56" height="56" style="width:56px;height:56px;border-radius:10px;border:1px solid #e5e7eb;object-fit:cover;background:#f9fafb;" />
              <div style="font-weight:700;color:#1a1a2e;font-size:13px;line-height:1.4;">${escapeHtml(item.productName)}</div>
            </div>
          </td>
          <td style="padding:14px 12px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;color:#555;font-size:13px;font-weight:600;">${item.quantity}×</td>
          <td style="padding:14px 12px;border-bottom:1px solid #f0f0f0;text-align:left;vertical-align:middle;color:#6B21A8;font-size:13px;font-weight:700;white-space:nowrap;">${formatPrice(lineTotal, data.currency)}</td>
        </tr>`;
    })
    .join('');

  const discountRow = data.discount > 0
    ? `
      <tr>
        <td style="padding:8px 14px;color:#16a34a;font-size:13px;font-weight:600;">
          🎟️ خصم${data.couponCode ? ` (${escapeHtml(data.couponCode)})` : ''}
        </td>
        <td style="padding:8px 14px;text-align:left;color:#16a34a;font-weight:700;font-size:13px;">−${formatPrice(data.discount, data.currency)}</td>
      </tr>`
    : '';

  const shippingRow = data.shippingCost > 0
    ? `
      <tr>
        <td style="padding:8px 14px;color:#555;font-size:13px;">🚚 الشحن</td>
        <td style="padding:8px 14px;text-align:left;color:#333;font-weight:600;font-size:13px;">${formatPrice(data.shippingCost, data.currency)}</td>
      </tr>`
    : `
      <tr>
        <td style="padding:8px 14px;color:#555;font-size:13px;">🚚 الشحن</td>
        <td style="padding:8px 14px;text-align:left;color:#16a34a;font-weight:700;font-size:13px;">مجاني</td>
      </tr>`;

  const notesBlock = data.notes
    ? `
      <div style="margin-top:18px;padding:14px 16px;background:#FFFBEB;border-radius:12px;border-right:4px solid #F5C518;">
        <p style="margin:0 0 4px;font-weight:700;color:#92400E;font-size:12px;">📝 ملاحظات العميل</p>
        <p style="margin:0;color:#78350F;font-size:13px;line-height:1.5;">${escapeHtml(data.notes)}</p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>طلب جديد #${escapeHtml(data.orderNumber)}</title>
</head>
<body style="margin:0;padding:20px 10px;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(26,26,46,0.12);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);padding:32px 28px;text-align:center;">
      <img src="https://moslimleader.com/white-Logo.webp" alt="Moslim Leader" width="140" style="height:auto;margin-bottom:14px;" />
      <h1 style="color:#F5C518;margin:0;font-size:24px;font-weight:900;letter-spacing:-0.5px;">
        🎁 طلب جديد: رقم #${escapeHtml(data.orderNumber)}
      </h1>
      <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:13px;font-weight:500;">
        لقد تلقيت طلبًا جديدًا من ${escapeHtml(data.customerName)}
      </p>
    </div>

    <!-- Order summary header -->
    <div style="padding:22px 28px 8px;border-bottom:1px solid #f3f4f6;">
      <h2 style="margin:0 0 4px;font-size:17px;color:#1a1a2e;font-weight:900;">ملخص الطلب</h2>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        <span style="color:#F5C518;font-weight:700;">#${escapeHtml(data.orderNumber)}</span>
        <span style="margin:0 8px;color:#d1d5db;">•</span>
        ${orderDate}
      </p>
    </div>

    <!-- Items table -->
    <table style="width:100%;border-collapse:collapse;margin:0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:right;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">المنتج</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">الكمية</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">السعر</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="padding:4px 14px 18px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 14px;color:#555;font-size:13px;">المجموع الفرعي</td>
          <td style="padding:8px 14px;text-align:left;color:#333;font-weight:600;font-size:13px;">${formatPrice(data.subtotal, data.currency)}</td>
        </tr>
        ${discountRow}
        ${shippingRow}
        <tr>
          <td colspan="2" style="padding:6px 0;"><div style="height:1px;background:#e5e7eb;"></div></td>
        </tr>
        <tr>
          <td style="padding:14px;color:#1a1a2e;font-size:15px;font-weight:900;">💰 الإجمالي</td>
          <td style="padding:14px;text-align:left;color:#1a1a2e;font-size:22px;font-weight:900;">${formatPrice(data.total, data.currency)}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;color:#6B7280;font-size:12px;">💳 وسيلة الدفع</td>
          <td style="padding:8px 14px;text-align:left;color:#1a1a2e;font-weight:700;font-size:13px;">${escapeHtml(payLabel)}</td>
        </tr>
      </table>
    </div>

    <!-- Customer + Address -->
    <div style="padding:0 28px 24px;">
      <div style="background:#f9fafb;border-radius:14px;padding:18px 20px;border:1px solid #f3f4f6;">
        <p style="margin:0 0 10px;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">👤 بيانات العميل</p>
        <p style="margin:0 0 4px;font-size:14px;color:#1a1a2e;font-weight:700;">${escapeHtml(data.customerName)}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#6B7280;">📧 ${escapeHtml(data.customerEmail)}</p>
        <p style="margin:0;font-size:12px;color:#6B7280;" dir="ltr">📱 ${escapeHtml(data.customerPhone)}</p>
      </div>

      <div style="background:#f9fafb;border-radius:14px;padding:18px 20px;border:1px solid #f3f4f6;margin-top:12px;">
        <p style="margin:0 0 10px;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📍 عنوان الشحن</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${addressLine || '—'}</p>
      </div>

      ${notesBlock}
    </div>

    <!-- CTA -->
    <div style="padding:0 28px 28px;text-align:center;">
      <a href="https://moslimleader.com/admin/orders" style="display:inline-block;background:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);color:#F5C518;font-weight:900;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:14px;box-shadow:0 4px 14px rgba(26,26,46,0.3);">
        مراجعة الطلب في لوحة الأدمن ←
      </a>
    </div>

    <!-- Footer -->
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);padding:18px 28px;text-align:center;">
      <p style="color:rgba(255,255,255,0.45);font-size:11px;margin:0 0 4px;">moslimleader.com — نظام إدارة الطلبات</p>
      <p style="color:#F5C518;font-size:12px;margin:0;font-weight:700;">جزاك الله خيرًا 🤍</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendOrderNotificationEmail(data: OrderEmailData): Promise<void> {
  try {
    const html = buildOrderEmailHtml(data);
    await transporter.sendMail({
      from: '"Moslim Leader Orders" <noreply@moslimleader.com>',
      to: 'orders@moslimleader.com',
      subject: `🎁 طلب جديد #${data.orderNumber} — ${data.customerName}`,
      html,
      replyTo: data.customerEmail,
    });
  } catch (err) {
    console.error('[order-email] send failed', err);
    // Don't throw — email failure shouldn't block order processing
  }
}
