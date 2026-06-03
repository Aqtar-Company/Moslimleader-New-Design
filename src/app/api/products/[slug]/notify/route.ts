export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { name, email, phone } = body as { name?: string; email?: string; phone?: string };

    if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني أو رقم واتساب' }, { status: 400 });
    }

    // Find product (DB or via slug lookup)
    const product = await prisma.product.findFirst({ where: { slug } });
    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    }

    // Avoid duplicate requests for the same contact info + product
    const emailVal = email?.trim() || null;
    const phoneVal = phone?.trim() || null;

    const existing = await prisma.notifyRequest.findFirst({
      where: {
        productId: product.id,
        ...(emailVal ? { email: emailVal } : { phone: phoneVal }),
        notified: false,
      },
    });

    if (existing) {
      // Already registered — silently succeed so we don't leak data
      return NextResponse.json({ ok: true });
    }

    await prisma.notifyRequest.create({
      data: {
        productId: product.id,
        name: name?.trim() || null,
        email: emailVal,
        phone: phoneVal,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notify POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
