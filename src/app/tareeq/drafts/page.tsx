export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import DraftsClient from './DraftsClient';

export const metadata: Metadata = { title: 'مسوداتي — طريق' };

export default function TareeqDraftsPage() {
  return <DraftsClient />;
}
