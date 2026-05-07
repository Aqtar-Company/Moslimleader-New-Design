// Coloured status pill used by orders, shipments, dashboard recent-orders
// list, and the campaign detail header. Pulls colours from the canonical
// STATUS_COLORS map in `src/lib/admin-status.ts` so a re-theme is one
// edit. Falls back to neutral grey for unknown statuses.
import React from 'react';
import { STATUS_COLORS } from '@/lib/admin-status';

interface StatusPillProps {
  status: string;
  className?: string;
}

export default function StatusPill({ status, className = '' }: StatusPillProps) {
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${color} ${className}`}>
      {status}
    </span>
  );
}
