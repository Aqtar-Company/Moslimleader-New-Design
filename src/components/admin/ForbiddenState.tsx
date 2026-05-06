'use client';

import Link from 'next/link';

interface Props {
  message?: string;
  /** Hint that tells the staff which permission they would need. */
  requiredPerm?: string;
}

// Empty-state component shown when an admin page hits a 403 from its
// initial load. Used in place of a generic "فشل التحميل" toast so the
// staff member understands what's happening.
export default function ForbiddenState({ message, requiredPerm }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-3xl">
        🔒
      </div>
      <h2 className="text-lg font-black text-gray-900 mb-2">غير مصرّح بهذه الصفحة</h2>
      <p className="text-sm text-gray-500 max-w-md">
        {message || 'الصفحة دي مش متاحة لصلاحياتك الحالية. تواصل مع الأدمن الرئيسي لو محتاج تشتغل عليها.'}
      </p>
      {requiredPerm && (
        <p className="text-xs text-gray-400 mt-2 font-mono" dir="ltr">
          requires: {requiredPerm}
        </p>
      )}
      <Link
        href="/admin/dashboard"
        className="mt-6 px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#2d1060] text-white text-sm font-bold transition"
      >
        ← الرجوع للرئيسية
      </Link>
    </div>
  );
}
