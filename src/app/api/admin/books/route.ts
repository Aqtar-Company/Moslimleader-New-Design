export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// GET /api/admin/books
export async function GET() {
  try {
    const guard = await requirePerm(['books.read', 'books.write'] as Permission[]);
    if ('response' in guard) return guard.response;

    const books = await prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { accesses: true } } },
    });

    return NextResponse.json({ books });
  } catch (err) {
    console.error('[admin books GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/books — create book record (file uploaded separately)
export async function POST(req: NextRequest) {
  try {
    const guard = await requirePerm('books.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

    const body = await req.json();
    const {
      title, titleEn, description, descriptionEn,
      cover, filePath, totalPages, freePages, price, priceUSD,
      author, authorEn, category, language, section,
      minAge, maxAge, needsParentalGuide,
      allowQuoteShare, allowFriendShare, friendShareHours,
      enableReferral, referralDiscount, enableWatermark, enableForensic, paperProductSlug, bgmUrl, promoVideoUrl,
    } = body;

    if (!title) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });

    const baseData = {
      title, titleEn, description: description || '', descriptionEn,
      cover: cover || '', filePath: filePath || '',
      totalPages: Number(totalPages) || 0,
      freePages: Number(freePages) || 10,
      price: Number(price) || 0,
      priceUSD: priceUSD ? Number(priceUSD) : null,
      author, authorEn, category,
      language: language || 'ar',
      section: section || 'books',
      allowQuoteShare: allowQuoteShare !== false,
      allowFriendShare: allowFriendShare !== false,
      friendShareHours: Number(friendShareHours) || 48,
      enableReferral: enableReferral !== false,
      referralDiscount: Number(referralDiscount) || 20,
      enableWatermark: enableWatermark !== false,
      enableForensic: enableForensic !== false,
      paperProductSlug: paperProductSlug || null,
        bgmUrl: bgmUrl || null,
        promoVideoUrl: promoVideoUrl || null,
      updatedAt: new Date(),
    };

    let book;
    try {
      book = await prisma.book.create({
        data: {
          ...baseData,
          minAge: minAge != null ? Number(minAge) : null,
          maxAge: maxAge != null ? Number(maxAge) : null,
          needsParentalGuide: needsParentalGuide === true,
        },
      });
    } catch {
      // Fallback if age columns don't exist yet
      book = await prisma.book.create({ data: baseData });
    }

    await logActionSafe({
      actor: auth,
      action: 'book.create',
      entity: 'Book',
      entityId: book.id,
      after: { title: book.title, price: book.price, section: book.section },
    });

    return NextResponse.json({ book });
  } catch (err) {
    console.error('[admin books POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
