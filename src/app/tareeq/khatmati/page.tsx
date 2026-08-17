import { getAuthUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import KhatmatiHome from './KhatmatiHome';

export const dynamic = 'force-dynamic';

export default async function KhatmatiPage() {
  const user = await getAuthUser().catch(() => null);
  let progress = null;
  if (user) {
    progress = await prisma.khatmatiProgress.findUnique({ where: { userId: user.userId } });
  }
  return <KhatmatiHome initialProgress={progress} />;
}
