import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/jwt';
import { PUBLIC_DESIGN_SELECT, loadLogoBanner, signDownloadToken } from '@/lib/logo-designs';
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
  const [designs, banner, user] = await Promise.all([
    prisma.logoDesign.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      select: PUBLIC_DESIGN_SELECT,
    }).catch(() => []),
    loadLogoBanner(),
    getAuthUser().catch(() => null),
  ]);
  // Downloading needs an account. A signed-in member gets, per design, a signed link a print
  // shop can open without one (it goes into the WhatsApp message and «نسخ رابط الملف»).
  const shareTokens: Record<number, string> = {};
  if (user) for (const d of designs) { const t = signDownloadToken(d.id); if (t) shareTokens[d.id] = t; }
  return <LogoStudio designs={designs} banner={banner} signedIn={!!user} shareTokens={shareTokens} />;
}
