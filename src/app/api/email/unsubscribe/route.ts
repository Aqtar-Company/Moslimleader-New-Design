export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const PAGE = (msg: string, ok: boolean) => `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>إلغاء الاشتراك — Moslim Leader</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,'Segoe UI',Cairo,sans-serif;background:#f7f7f9;margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#fff;border-radius:18px;padding:36px 28px;max-width:420px;width:90%;text-align:center;box-shadow:0 18px 40px rgba(20,10,60,.12);border:1px solid #efefef}
  .icon{font-size:48px;margin-bottom:14px}
  h1{font-size:18px;color:${ok ? '#16a34a' : '#b91c1c'};margin:0 0 10px}
  p{color:#555;font-size:14px;line-height:1.7;margin:0}
  a{color:#6B21A8;text-decoration:none;font-weight:bold}
</style>
</head><body>
  <div class="card">
    <div class="icon">${ok ? '✅' : '⚠️'}</div>
    <h1>${ok ? 'تم إلغاء الاشتراك' : 'تعذّر إلغاء الاشتراك'}</h1>
    <p>${msg}</p>
    <p style="margin-top:18px"><a href="https://moslimleader.com">العودة للموقع</a></p>
  </div>
</body></html>`;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response(PAGE('الرابط غير صحيح.', false), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const user = await prisma.user.findUnique({ where: { marketingToken: token } });
  if (!user) {
    return new Response(PAGE('الرابط منتهي أو غير صالح.', false), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (!user.marketingOptIn) {
    return new Response(PAGE('أنت بالفعل غير مشترك في الحملات التسويقية.', true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  await prisma.user.update({ where: { id: user.id }, data: { marketingOptIn: false } });
  return new Response(
    PAGE('لن تصلك حملات تسويقية بعد الآن. ستظل تستقبل تأكيدات الطلبات والإشعارات الضرورية.', true),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

// One-click unsubscribe (RFC 8058) for Gmail/Outlook headers
export async function POST(req: NextRequest) {
  return GET(req);
}
