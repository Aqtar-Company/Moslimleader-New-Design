// Standard heading block used at the top of every admin page. Title is
// rendered as a black-weight h1; subtitle is an optional grey caption.
// Consolidates ~23 inline copies. Layout is intentionally minimal so
// callers can wrap it with their own filter/action row.
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-xl font-black text-gray-900">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
