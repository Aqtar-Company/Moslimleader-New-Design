export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMergedStaticProduct } from '@/lib/product-overrides';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`notify:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'حاول مرة أخرى لاحقاً' }, { status: 429 });
    }

    const { slug } = await params;
    const body = await req.json();
    const { name, email, phone } = body as { name?: string; email?: string; phone?: string };

    // Validate using trimmed values — whitespace-only inputs are treated as empty.
    const emailVal = email?.trim() || null;
    const phoneVal = phone?.trim() || null;

    if (!emailVal && !phoneVal) {
      return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني أو رقم واتساب' }, { status: 400 });
    }

    // Resolve product: try DB first (covers admin-created + seeded static rows),
    // then fall back to the pure static definition + overrides. comingSoon static
    // products are never seeded via ensureProductInDb (add-to-cart is blocked),
    // so the fallback is essential.
    let productId: string;
    const dbProduct = await prisma.product.findFirst({ where: { slug } });
    if (dbProduct) {
      productId = dbProduct.id;
    } else {
      const staticProduct = await getMergedStaticProduct(slug);
      if (!staticProduct) {
        return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
      }
      productId = staticProduct.id;
      // Seed a minimal DB row so the relation FK can be satisfied and the admin
      // notify-requests page can include the product name/image.
      try {
        await prisma.product.upsert({
          where: { id: productId },
          create: {
            id: productId,
            slug: staticProduct.slug,
            name: staticProduct.name,
            nameEn: staticProduct.nameEn,
            shortDescription: staticProduct.shortDescription || '',
            description: staticProduct.description || '',
            price: staticProduct.price,
            priceUsd: staticProduct.priceUsd || 0,
            category: staticProduct.category,
            tags: staticProduct.tags || [],
            images: staticProduct.images || [],
            inStock: staticProduct.inStock ?? true,
            weight: staticProduct.weight || 0,
            source: 'static',
          },
          update: {},
        });
      } catch (seedErr) {
        console.error('[notify] seed static product failed:', seedErr);
        // Non-fatal — the product row may already exist under a race condition.
      }
    }

    // Avoid duplicate pending requests for the same contact + product.
    const existing = await prisma.notifyRequest.findFirst({
      where: {
        productId,
        OR: [
          ...(emailVal ? [{ email: emailVal }] : []),
          ...(phoneVal ? [{ phone: phoneVal }] : []),
        ],
        notified: false,
      },
    });

    if (existing) {
      // Silently succeed — don't reveal whether the contact is already registered.
      return NextResponse.json({ ok: true });
    }

    await prisma.notifyRequest.create({
      data: {
        productId,
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
