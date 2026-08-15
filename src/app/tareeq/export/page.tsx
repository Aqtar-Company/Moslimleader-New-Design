import { Suspense } from 'react';
import TareeqExportClient from './TareeqExportClient';

export const metadata = { title: 'تصدير البيانات — طريق' };

export default function TareeqExportPage() {
  return (
    <Suspense>
      <TareeqExportClient />
    </Suspense>
  );
}
