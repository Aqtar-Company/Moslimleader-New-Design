export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { createPayPalOrder } from '@/lib/paypal';

// POST /api/books/[id]/paypal-create — create a PayPal order for a single book
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const { id: bookId } = await params;

    // Check if user already has access
    const existing = await prisma.bookAccess.findUnique({
      where: { userId_bookId: { userId: auth.userId, bookId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'لديك وصول بالفعل لهذا الكتاب' }, { status: 400 });
    }

    // Fetch the book (server-side price, never trust client)
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, title: true, price: true, priceUSD: true, isPublished: true },
    });

    if (!book || !book.isPublished) {
      return NextResponse.json({ error: 'الكتاب غير متاح' }, { status: 404 });
    }

    // Calculate USD price server-side
    const priceUsd = book.priceUSD && book.priceUSD > 0
      ? Number(book.priceUSD)
      : Number(book.price) * 0.10; // fallback: 10% of EGP

    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return NextResponse.json({ error: 'خطأ في سعر الكتاب' }, { status: 400 });
    }

    const finalUsd = Math.max(0.01, Math.round(priceUsd * 100) / 100);
    const referenceId = `book-${bookId}-${auth.userId}-${Date.now()}`;

    const paypalOrder = await createPayPalOrder(finalUsd, 'USD', referenceId);

    return NextResponse.json({
      paypalOrderId: paypalOrder.id,
      expectedAmountUsd: finalUsd,
      bookTitle: book.title,
    });
  } catch (err) {
    console.error('[books paypal-create]', err);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء طلب الدفع' }, { status: 500 });
  }
}
