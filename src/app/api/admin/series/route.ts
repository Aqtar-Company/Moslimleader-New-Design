export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm, type Permission } from '@/lib/permissions';
import { logActionSafe } from '@/lib/audit-log';

// GET /api/admin/series — list all series with book count
export async function GET() {
  try {
    const guard = await requirePerm(['books.read', 'books.write'] as Permission[]);
    if ('response' in guard) return guard.response;

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
    const guard = await requirePerm('books.write');
    if ('response' in guard) return guard.response;
    const auth = guard.user;

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

    await logActionSafe({
      actor: auth,
      action: 'series.create',
      entity: 'BookSeries',
      entityId: series.id,
      after: { name: series.name, slug: series.slug },
    });

    return NextResponse.json({ series });
  } catch (err: unknown) {
    console.error('[admin series POST]', err);
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'هذا الـ slug مستخدم بالفعل' }, { status: 400 });
    }
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
