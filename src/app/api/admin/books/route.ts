export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// GET /api/admin/books
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

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
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

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

    return NextResponse.json({ book });
  } catch (err) {
    console.error('[admin books POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
