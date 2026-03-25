export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';


// Helper: resolve product from DB or static fallback
async function resolveProduct(productId: string) {
  const dbProduct = await prisma.product.findUnique({ where: { id: productId } });
  if (dbProduct) return dbProduct;
  return staticProducts.find(p => p.id === productId) ?? null;
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

    const product = await resolveProduct(productId);
    if (!product) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });

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
        productId,
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
          productId,
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
