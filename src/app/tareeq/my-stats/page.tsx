export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import MyStatsClient from './MyStatsClient';
export const metadata: Metadata = { title: 'أثر علاماتي — طريق' };
export default function TareeqMyStatsPage() { return <MyStatsClient />; }
