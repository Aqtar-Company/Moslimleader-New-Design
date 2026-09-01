import { Metadata } from 'next';
import TareeqGroupsListClient from './TareeqGroupsListClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'المجموعات | طريق' };

export default function TareeqGroupsListPage() {
  return <TareeqGroupsListClient />;
}
