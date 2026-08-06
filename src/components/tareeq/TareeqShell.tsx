'use client';
import { useRouter } from 'next/navigation';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import TareeqBottomNav from './TareeqBottomNav';
import TareeqOfflineBanner from './TareeqOfflineBanner';

export default function TareeqShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <TareeqNotificationsProvider>
      <TareeqOfflineBanner />
      {children}
      <TareeqBottomNav onCreateClick={() => router.push('/tareeq?action=create')} />
    </TareeqNotificationsProvider>
  );
}
