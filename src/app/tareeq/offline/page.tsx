import { Suspense } from 'react';
import TareeqOfflineClient from './TareeqOfflineClient';

export const metadata = { title: 'القراءة بدون إنترنت — طريق' };

export default function TareeqOfflinePage() {
  return (
    <Suspense>
      <TareeqOfflineClient />
    </Suspense>
  );
}
