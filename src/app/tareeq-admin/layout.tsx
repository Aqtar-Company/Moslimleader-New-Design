import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'لوحة تحكم طريق',
  robots: 'noindex, nofollow',
};

export default function TareeqAdminLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#0f172a', minHeight: '100vh' }}>{children}</div>;
}
