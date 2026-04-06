export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';


// Helper: ensure product exists in DB (seed from static list if needed)
async function ensureProductInDb(productId: string) {
  // Try by id first
  let dbProduct = await prisma.product.findFirst({
    where: { OR: [{ id: productId }, { slug: productId }] },
  });
  if (dbProduct) return dbProduct;

  // Not in DB — look in static list and seed it
  const staticP = staticProducts.find(p => p.id === productId || p.slug === productId);
  if (!staticP) return null;

  dbProduct = await prisma.product.upsert({
    where: { slug: staticP.slug },
    create: {
      id: staticP.id,
      slug: staticP.slug,
      name: staticP.name,
      nameEn: staticP.nameEn,
      shortDescription: staticP.shortDescription,
      shortDescriptionEn: staticP.shortDescriptionEn,
      description: staticP.description,
      descriptionEn: staticP.descriptionEn,
      price: staticP.price,
      category: staticP.category,
      subcategory: staticP.subcategory,
      variants: (staticP.variants ?? []) as object[],
      tags: staticP.tags as string[],
      images: staticP.images as string[],
      inStock: staticP.inStock,
      featured: staticP.featured ?? false,
      videos: staticP.videos ?? [],
      weight: staticP.weight,
      source: 'static',
    },
    update: {},
  });
  return dbProduct;
}

// GET /api/cart — fetch user's cart
export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ items: [] }, { status: 401 });

    const cart = await prisma.cart.findUnique({
      where: { userId: auth.userId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart) return NextResponse.json({ items: [] });

    const items = cart.items.map(item => ({
      cartItemId: item.id,
      product: item.product,
      quantity: item.quantity,
      selectedModel: item.selectedModel ?? undefined,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[cart GET]', err);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}

// POST /api/cart — add item to cart
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { productId, quantity = 1, selectedModel } = await req.json();
    if (!productId) return NextResponse.json({ error: 'productId مطلوب' }, { status: 400 });

    // Ensure product exists in DB (seed static product if needed)
    const dbProduct = await ensureProductInDb(String(productId));
    if (!dbProduct) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });

    // Use the actual DB product id (may differ from the slug/id sent from client)
    const realProductId = dbProduct.id;

    // Upsert cart for user
    let cart = await prisma.cart.findUnique({ where: { userId: auth.userId } });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: auth.userId, updatedAt: new Date() },
      });
    }

    // Check if same product+model already in cart
    const existing = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: realProductId,
        selectedModel: selectedModel ?? null,
      },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: realProductId,
          quantity,
          selectedModel: selectedModel ?? null,
        },
      });
    }

    await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[cart POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE /api/cart — clear entire cart
export async function DELETE() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const cart = await prisma.cart.findUnique({ where: { userId: auth.userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[cart DELETE]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
