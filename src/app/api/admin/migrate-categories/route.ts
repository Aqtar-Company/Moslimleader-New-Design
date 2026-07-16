export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePerm } from '@/lib/permissions';

const CATEGORY_MAP: Record<string, string> = {
  'ألعاب تعليمية': 'الألعاب الورقية وتنمية المهارات',
  'ألعاب تربوية': 'الألعاب الورقية وتنمية المهارات',
  'كتب': 'القصص والكتب والروايات',
  'كتب الأسرة': 'القصص والكتب والروايات',
  'قصص الأطفال': 'القصص والكتب والروايات',
  'ثقافة دينية': 'القصص والكتب والروايات',
  'أدوات القرآن': 'أدوات تعليم القرآن',
  'مفكرات': 'الأدوات والمستلزمات الدراسية',
  'أدوات مكتبية': 'الأدوات والمستلزمات الدراسية',
  'المدرسة': 'الأدوات والمستلزمات الدراسية',
  'إكسسوار': 'الهدايا والمقتنيات',
  'مجات': 'الهدايا والمقتنيات',
  'هدايا': 'الهدايا والمقتنيات',
};

export async function POST() {
  const guard = await requirePerm('products.write');
  if ('response' in guard) return guard.response;

  let updated = 0;
  for (const [oldCat, newCat] of Object.entries(CATEGORY_MAP)) {
    const result = await prisma.product.updateMany({
      where: { category: oldCat },
      data: { category: newCat },
    });
    updated += result.count;
  }

  return NextResponse.json({ updated, message: `تم تحديث ${updated} منتج` });
}
