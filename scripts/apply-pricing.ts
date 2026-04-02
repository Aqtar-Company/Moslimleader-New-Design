// Script to apply regional pricing to all products in the DB
// Run: npx ts-node --project tsconfig.json scripts/apply-pricing.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const pricing = [
  { id: '1',  egp: 230, usd: 5 },
  { id: '2',  egp: 320, usd: 7 },
  { id: '3',  egp: 230, usd: 5 },
  { id: '4',  egp: 250, usd: 5.5 },
  { id: '5',  egp: 160, usd: 3.5 },
  { id: '6',  egp: 160, usd: 3.5 },
  { id: '7',  egp: 350, usd: 7.5 },
  { id: '8',  egp: 220, usd: 5 },
  { id: '9',  egp: 180, usd: 4 },
  { id: '10', egp: 180, usd: 4 },
  { id: '11', egp: 160, usd: 3.5 },
  { id: '12', egp: 220, usd: 5 },
  { id: '13', egp: 190, usd: 4 },
  { id: '14', egp: 200, usd: 4.5 },
  { id: '15', egp: 200, usd: 4.5 },
  { id: '16', egp: 160, usd: 3.5 },
  { id: '17', egp: 160, usd: 3.5 },
  { id: '18', egp: 280, usd: 6 },
  { id: '19', egp: 190, usd: 4 },
  { id: '20', egp: 170, usd: 3.75 },
  { id: '21', egp: 170, usd: 3.75 },
  { id: '22', egp: 170, usd: 3.75 },
  { id: '23', egp: 35,  usd: 0.75 },
];

async function main() {
  // Build the overrides object
  const overrides: Record<string, { regionalPricing: { price_egp_manual: number; price_usd_manual: number } }> = {};
  for (const p of pricing) {
    overrides[p.id] = {
      regionalPricing: {
        price_egp_manual: p.egp,
        price_usd_manual: p.usd,
      },
    };
  }

  await prisma.setting.upsert({
    where: { key: 'product-overrides' },
    create: { key: 'product-overrides', value: overrides as object, updatedAt: new Date() },
    update: { value: overrides as object, updatedAt: new Date() },
  });

  console.log('✅ Applied regional pricing to', pricing.length, 'products');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
