import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { PUBLIC_DESIGN_SELECT, loadLogoBanner } from '@/lib/logo-designs';
import LogoStudio from './LogoStudio';

// Designs and the banner are edited from the admin and must show at once.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'شعار مسلم ليدر للطباعة — حمّل التصميم واطبعه على تيشرت',
  description: 'تصميمات شعار مسلم ليدر جاهزة للطباعة على التيشرتات: جرّب الشعار على ألوان مختلفة، حمّل ملف الطباعة، وابعته للمطبعة على واتساب.',
  openGraph: {
    title: 'شعار مسلم ليدر للطباعة',
    description: 'حمّل التصميم، جرّبه على لون التيشرت، وابعته للمطبعة على واتساب.',
    url: 'https://moslimleader.com/logo',
    type: 'website',
  },
};

export default async function LogoPage() {
  const [designs, banner] = await Promise.all([
    prisma.logoDesign.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      select: PUBLIC_DESIGN_SELECT,
    }).catch(() => []),
    loadLogoBanner(),
  ]);
  return <LogoStudio designs={designs} banner={banner} />;
}
