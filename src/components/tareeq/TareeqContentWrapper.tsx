'use client';
import { usePathname } from 'next/navigation';

export default function TareeqContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // Only the read page is full-screen (no bottom nav) — home page keeps normal padding
  const isNuri = pathname.startsWith('/tareeq/khatmati/read');
  return (
    <div className={isNuri ? 'relative' : 'relative pb-[60px] sm:pb-0'}>
      {children}
    </div>
  );
}
