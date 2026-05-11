export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed } = checkRateLimit(`catalog-lead:${ip}`, 5, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'حاول مرة أخرى لاحقاً' }, { status: 429 });
    }

    const body = await req.json();
    const { name, phone, city, productId, productName, notes, selectedProducts } = body;

    if (!name || !phone || !city || !productName) {
      return NextResponse.json(
        { error: 'الرجاء ملء جميع الحقول المطلوبة' },
        { status: 400 },
      );
    }

    await prisma.catalogLead.create({
      data: {
        name: String(name).slice(0, 100),
        phone: String(phone).slice(0, 20),
        city: String(city).slice(0, 100),
        productId: productId ? String(productId).slice(0, 100) : null,
        productName: String(productName).slice(0, 500),
        notes: notes ? String(notes).slice(0, 500) : null,
        selectedProducts: Array.isArray(selectedProducts) ? selectedProducts : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[catalog-leads POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
