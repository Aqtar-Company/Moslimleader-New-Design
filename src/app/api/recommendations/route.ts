export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { products as staticProducts } from '@/lib/products';

// GET /api/recommendations?age=8&gender=boy
// Returns up to 4 products matching the child's age and gender.
// Uses static product list (no DB query needed — prices come from static).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const age = parseInt(searchParams.get('age') || '0', 10);
  const gender = searchParams.get('gender') || ''; // 'boy' | 'girl' | ''

  if (isNaN(age) || age < 0 || age > 25) {
    return NextResponse.json({ products: [] });
  }

  const productGender = gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : null;

  const matched = staticProducts
    .filter(p => {
      const min = p.minAge ?? 0;
      const max = p.maxAge ?? 99;
      if (age < min || age > max) return false;
      if (productGender && p.gender && p.gender !== 'both' && p.gender !== productGender) return false;
      return p.inStock !== false;
    })
    .slice(0, 4)
    .map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      nameEn: p.nameEn,
      shortDescription: p.shortDescription,
      shortDescriptionEn: p.shortDescriptionEn,
      price: p.price,
      image: p.images?.[0] ?? null,
      minAge: p.minAge,
      maxAge: p.maxAge,
      gender: p.gender,
    }));

  return NextResponse.json({ products: matched });
}
