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

const PAY_METHOD_LABELS: Record<string, { ar: string; icon: string }> = {
  cod: { ar: 'الدفع عند الاستلام', icon: '💵' },
  card: { ar: 'بطاقة ائتمان', icon: '💳' },
  paypal: { ar: 'PayPal', icon: '🅿️' },
  vodafone: { ar: 'Vodafone Cash', icon: '📱' },
  instapay: { ar: 'InstaPay', icon: '⚡' },
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

  const payInfo = PAY_METHOD_LABELS[data.paymentMethod] || { ar: data.paymentMethod, icon: '💰' };
  const addressLine = buildAddressLine(data.shippingAddress);

  // ─── Items rows (table-based for email compatibility) ─────
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
          <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="68" style="padding:0 0 0 12px;vertical-align:middle;">
                  <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.productName)}" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:10px;border:1px solid #e5e7eb;object-fit:cover;background:#f9fafb;" />
                </td>
                <td style="vertical-align:middle;padding:0 8px;">
                  <p style="margin:0 0 4px;font-weight:700;color:#1a1a2e;font-size:13px;line-height:1.4;">${escapeHtml(item.productName)}</p>
                  <p style="margin:0;font-size:11px;color:#9ca3af;font-family:monospace;">
                    ${formatPrice(item.unitPrice, data.currency)} × ${item.quantity}
                  </p>
                </td>
                <td width="100" style="vertical-align:middle;text-align:left;padding:0 12px 0 0;white-space:nowrap;">
                  <p style="margin:0;color:#6B21A8;font-size:14px;font-weight:900;">${formatPrice(lineTotal, data.currency)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');

  // ─── Discount row (with coupon badge) ─────
  const discountRow = data.discount > 0
    ? `
      <tr>
        <td style="padding:8px 24px;color:#16a34a;font-size:13px;font-weight:600;">
          🎟️ خصم${data.couponCode ? ` <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-size:10px;font-family:monospace;font-weight:900;letter-spacing:0.5px;margin-right:4px;">${escapeHtml(data.couponCode)}</span>` : ''}
        </td>
        <td style="padding:8px 24px;text-align:left;color:#16a34a;font-weight:700;font-size:13px;white-space:nowrap;">−${formatPrice(data.discount, data.currency)}</td>
      </tr>`
    : '';

  // ─── Shipping row ─────
  const shippingRow = data.shippingCost > 0
    ? `
      <tr>
        <td style="padding:8px 24px;color:#555;font-size:13px;">🚚 الشحن</td>
        <td style="padding:8px 24px;text-align:left;color:#333;font-weight:600;font-size:13px;white-space:nowrap;">${formatPrice(data.shippingCost, data.currency)}</td>
      </tr>`
    : `
      <tr>
        <td style="padding:8px 24px;color:#555;font-size:13px;">🚚 الشحن</td>
        <td style="padding:8px 24px;text-align:left;color:#16a34a;font-weight:700;font-size:13px;">مجاني</td>
      </tr>`;

  // ─── Notes block ─────
  const notesBlock = data.notes
    ? `
    <tr>
      <td style="padding:0 24px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFBEB;border-radius:12px;border-right:4px solid #F5C518;">
          <tr>
            <td style="padding:14px 16px;">
              <p style="margin:0 0 4px;font-weight:700;color:#92400E;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">📝 ملاحظات العميل</p>
              <p style="margin:0;color:#78350F;font-size:13px;line-height:1.5;">${escapeHtml(data.notes)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" dir="rtl" lang="ar">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>طلب جديد #${escapeHtml(data.orderNumber)}</title>
<!--[if mso]>
<style>table {border-collapse:collapse;border-spacing:0;margin:0;} div, td {padding:0;} div {margin:0 !important;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">

<!-- Outer wrapper -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;padding:20px 10px;">
  <tr>
    <td align="center">

      <!-- Email container -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(26,26,46,0.12);">

        <!-- ═══════════ HEADER (Brand) ═══════════ -->
        <tr>
          <td style="background:#1a1a2e;background-image:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);padding:32px 28px;text-align:center;">
            <img src="https://moslimleader.com/white-Logo.webp" alt="Moslim Leader" width="140" style="display:block;margin:0 auto 14px;height:auto;border:0;outline:none;" />
            <p style="margin:0;color:#F5C518;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">فاتورة الطلب</p>
            <p style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:900;font-family:monospace;">#${escapeHtml(data.orderNumber)}</p>
          </td>
        </tr>

        <!-- ═══════════ META STRIP (Date + Customer name) ═══════════ -->
        <tr>
          <td style="background:#FFFBEB;border-bottom:1px solid #fef3c7;padding:14px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-size:12px;color:#92400E;font-weight:700;">
                  📅 ${orderDate}
                </td>
                <td align="left" style="font-size:11px;color:#78350F;">
                  من: <strong>${escapeHtml(data.customerName)}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ ITEMS SECTION ═══════════ -->
        <tr>
          <td style="padding:24px 28px 8px;">
            <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🛒 المنتجات (${data.items.length})</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafafa;border-radius:14px;border:1px solid #f3f4f6;">
              ${itemsRows}
            </table>
          </td>
        </tr>

        <!-- ═══════════ TOTALS SECTION ═══════════ -->
        <tr>
          <td style="padding:8px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:8px 24px;color:#555;font-size:13px;">المجموع الفرعي</td>
                <td style="padding:8px 24px;text-align:left;color:#333;font-weight:600;font-size:13px;white-space:nowrap;">${formatPrice(data.subtotal, data.currency)}</td>
              </tr>
              ${discountRow}
              ${shippingRow}
              <tr>
                <td colspan="2" style="padding:8px 24px 0;">
                  <div style="height:2px;background:#e5e7eb;border-radius:1px;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 24px 6px;color:#1a1a2e;font-size:15px;font-weight:900;">💰 الإجمالي</td>
                <td style="padding:14px 24px 6px;text-align:left;color:#1a1a2e;font-size:24px;font-weight:900;white-space:nowrap;">${formatPrice(data.total, data.currency)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding:0 24px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px dashed #e5e7eb;">
                    <tr>
                      <td style="padding-top:12px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">وسيلة الدفع</td>
                      <td align="left" style="padding-top:12px;font-size:13px;color:#1a1a2e;font-weight:700;">
                        ${payInfo.icon} ${escapeHtml(payInfo.ar)}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ CUSTOMER + ADDRESS (2 cards in a row) ═══════════ -->
        <tr>
          <td style="padding:8px 28px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <!-- Customer card -->
                <td width="50%" valign="top" style="padding:0 4px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border-radius:14px;border:1px solid #f3f4f6;">
                    <tr>
                      <td style="padding:16px 18px;">
                        <p style="margin:0 0 8px;font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">👤 العميل</p>
                        <p style="margin:0 0 4px;font-size:14px;color:#1a1a2e;font-weight:700;">${escapeHtml(data.customerName)}</p>
                        <p style="margin:0 0 4px;font-size:11px;color:#6B7280;word-break:break-all;">📧 ${escapeHtml(data.customerEmail)}</p>
                        <p style="margin:0;font-size:11px;color:#6B7280;font-family:monospace;" dir="ltr">📱 ${escapeHtml(data.customerPhone)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Address card -->
                <td width="50%" valign="top" style="padding:0 0 0 4px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border-radius:14px;border:1px solid #f3f4f6;">
                    <tr>
                      <td style="padding:16px 18px;">
                        <p style="margin:0 0 8px;font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📍 عنوان الشحن</p>
                        <p style="margin:0;font-size:12px;color:#374151;line-height:1.6;">${addressLine || '—'}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${notesBlock}

        <!-- ═══════════ CTA BUTTON ═══════════ -->
        <tr>
          <td align="center" style="padding:8px 28px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#1a1a2e;background-image:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);border-radius:12px;">
                  <a href="https://moslimleader.com/admin/orders" style="display:inline-block;padding:14px 32px;color:#F5C518;font-weight:900;font-size:14px;text-decoration:none;font-family:Arial,sans-serif;">
                    مراجعة الطلب في لوحة الأدمن ←
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ FOOTER ═══════════ -->
        <tr>
          <td style="background:#1a1a2e;background-image:linear-gradient(135deg,#1a1a2e 0%,#2d1060 100%);padding:18px 28px;text-align:center;">
            <p style="margin:0 0 4px;color:rgba(255,255,255,0.45);font-size:11px;">moslimleader.com — نظام إدارة الطلبات</p>
            <p style="margin:0;color:#F5C518;font-size:12px;font-weight:700;">جزاك الله خيرًا 🤍</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

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
