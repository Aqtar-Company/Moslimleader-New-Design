'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TareeqNotificationsProvider } from '@/context/TareeqNotificationsContext';
import TareeqBottomNav from './TareeqBottomNav';
import TareeqOfflineBanner from './TareeqOfflineBanner';
import TareeqSplash from './TareeqSplash';
import TareeqIncomingCall from './TareeqIncomingCall';

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

  // When camera captures a file on a non-feed page, navigate to /tareeq.
  // TareeqClient will consume the file from the store on arrival.
  useEffect(() => {
    const h = () => {
      if (pathname !== '/tareeq') router.push('/tareeq');
      // If already on /tareeq, TareeqClient handles the event directly.
    };
    window.addEventListener('tareeq-camera-ready', h);
    return () => window.removeEventListener('tareeq-camera-ready', h);
  }, [pathname, router]);

  // Hide bottom nav inside conversations and group chats (they have their own fixed input bars)
  const hideNav = /^\/tareeq\/inbox\/.+/.test(pathname ?? '') || /^\/tareeq\/groups\/.+/.test(pathname ?? '');

  return (
    <TareeqNotificationsProvider>
      <TareeqSplash />
      <TareeqOfflineBanner />
      {children}
      {!hideNav && <div className="lg:hidden"><TareeqBottomNav onCreateClick={handleCreateClick} /></div>}
      {/* Global incoming-call overlay — works from any page in the app */}
      <TareeqIncomingCall />
    </TareeqNotificationsProvider>
  );
}
