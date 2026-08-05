export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/jwt';

export default async function TareeqProfilePage() {
  const user = await getAuthUser().catch(() => null);
  if (!user) redirect('/login?mode=signin&next=/tareeq/profile');
  redirect(`/tareeq/u/${user.userId}`);
}
