'use client';
import { useRouter, usePathname } from 'next/navigation';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import TareeqBottomNav from './TareeqBottomNav';
import TareeqOfflineBanner from './TareeqOfflineBanner';
import TareeqSplash from './TareeqSplash';

export default function TareeqShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleCreateClick() {
    if (pathname === '/tareeq') {
      window.dispatchEvent(new Event('tareeq-open-create'));
    } else {
      router.push('/tareeq?action=create');
    }
  }

  return (
    <TareeqNotificationsProvider>
      <TareeqSplash />
      <TareeqOfflineBanner />
      {children}
      <TareeqBottomNav onCreateClick={handleCreateClick} />
    </TareeqNotificationsProvider>
  );
}
