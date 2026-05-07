// Empty-state row shown inside admin tables/lists when the data set is
// empty. Replaces the ~19 inline `لا توجد...` div blocks. Optional
// `icon` is rendered as a 2xl emoji above the message.
import React from 'react';

interface EmptyStateProps {
  message: string;
  icon?: string;
}

export default function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="py-12 text-center text-gray-400 text-sm">
      {icon && <span className="text-2xl block mb-2">{icon}</span>}
      {message}
    </div>
  );
}
