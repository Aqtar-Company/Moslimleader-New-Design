export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth || auth.role !== 'admin') return null;
  return auth;
}

// GET /api/admin/series — list all series with book count
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const series = await prisma.bookSeries.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        books: {
          select: { id: true, title: true, titleEn: true, cover: true, price: true, seriesOrder: true, language: true, isPublished: true },
          orderBy: { seriesOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({ series });
  } catch (err) {
    console.error('[admin series GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST /api/admin/series — create new series
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const body = await req.json();
    const { name, nameEn, slug, description, descriptionEn, cover, seriesPrice, seriesPriceUSD, language, isPublished } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'الاسم والـ slug مطلوبان' }, { status: 400 });
    }

    const series = await prisma.bookSeries.create({
      data: {
        name,
        nameEn: nameEn || null,
        slug,
        description: description || null,
        descriptionEn: descriptionEn || null,
        cover: cover || null,
        seriesPrice: seriesPrice ? parseFloat(seriesPrice) : null,
        seriesPriceUSD: seriesPriceUSD ? parseFloat(seriesPriceUSD) : null,
        language: language || 'ar',
        isPublished: isPublished !== false,
      },
    });

    return NextResponse.json({ series });
  } catch (err: any) {
    console.error('[admin series POST]', err);
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'هذا الـ slug مستخدم بالفعل' }, { status: 400 });
    }
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
