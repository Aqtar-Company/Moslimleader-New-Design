/**
 * seed.ts — تعبئة قاعدة البيانات بالمنتجات الأساسية
 * التشغيل: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Import static products
import { products } from '../src/lib/products';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 بدء تعبئة قاعدة البيانات...');

  // ── Seed Products ──────────────────────────────────────────────────────────
  console.log(`📦 إضافة ${products.length} منتج...`);
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        nameEn: p.nameEn ?? null,
        shortDescription: p.shortDescription,
        shortDescriptionEn: p.shortDescriptionEn ?? null,
        description: p.description,
        descriptionEn: p.descriptionEn ?? null,
        price: p.price,
        category: p.category,
        subcategory: p.subcategory ?? null,
        variants: (p.variants ?? []) as object[],
        tags: p.tags as string[],
        images: p.images as string[],
        inStock: p.inStock,
        featured: p.featured ?? false,
        videos: p.videos ?? [],
        weight: p.weight,
        source: 'static',
      },
      update: {
        price: p.price,
        inStock: p.inStock,
        featured: p.featured ?? false,
      },
    });
  }
  console.log('✅ المنتجات تمت إضافتها');

  // ── Seed Admin User ────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@moslimleader.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123456';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: 'مسؤول النظام',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        savedAddresses: [],
      },
    });
    console.log(`✅ تم إنشاء حساب المسؤول: ${adminEmail}`);
  } else {
    console.log(`ℹ️  حساب المسؤول موجود: ${adminEmail}`);
  }

  console.log('🎉 تمت تعبئة قاعدة البيانات بنجاح!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
