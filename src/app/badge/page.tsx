import type { Metadata } from 'next';
import { getAuthUser } from '@/lib/jwt';
import BadgeStudio from './BadgeStudio';
import { ensureReferralCode, referralLink, REFERRAL_REWARD_POINTS } from '@/lib/referral';

// The sign-in state decides what is shown, so this page is never cached.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'بادج مسلم ليدر — ضعه على صورتك',
  description: 'ارفع صورتك، ضع عليها بادج مسلم ليدر، وحمّلها بجودة عالية لتستخدمها في أي مكان.',
  openGraph: {
    title: 'بادج مسلم ليدر',
    description: 'ارفع صورتك، ضع عليها بادج مسلم ليدر، وحمّلها لتستخدمها في أي مكان.',
    url: 'https://moslimleader.com/badge',
    type: 'website',
    images: [{ url: 'https://moslimleader.com/badge-pictures/og.jpg', width: 1200, height: 630 }],
  },
};

export default async function BadgePage() {
  const user = await getAuthUser().catch(() => null);
  // The post a member shares carries THEIR invite link, so every badge posted on Facebook or
  // WhatsApp brings people in under the member who posted it.
  const code = user ? await ensureReferralCode(user.userId).catch(() => null) : null;
  return <BadgeStudio signedIn={!!user} shareUrl={code ? referralLink(code) : null} rewardPoints={REFERRAL_REWARD_POINTS} />;
}
