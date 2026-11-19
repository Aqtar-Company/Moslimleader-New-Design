import type { Metadata } from 'next';
import { getAuthUser } from '@/lib/jwt';
import BadgeStudio from './BadgeStudio';

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
  },
};

export default async function BadgePage() {
  const user = await getAuthUser().catch(() => null);
  return <BadgeStudio signedIn={!!user} />;
}
