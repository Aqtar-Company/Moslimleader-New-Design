'use client';

interface PaginationFooterProps {
  shown: number;
  total: number;
  loading?: boolean;
  onLoadMore: () => void;
  onLoadAll: () => void;
  step?: number;
}

export function PaginationFooter({ shown, total, loading, onLoadMore, onLoadAll, step = 50 }: PaginationFooterProps) {
  if (total === 0) return null;
  const remaining = total - shown;
  const allShown = shown >= total;

  return (
    <div className="space-y-3 pt-2">
      {loading && (
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden relative">
          <div className="absolute inset-y-0 w-1/3 bg-[#F5C518] rounded-full" style={{ animation: 'pagebar 1.2s ease-in-out infinite' }} />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-gray-500">
          عرض <span className="font-bold text-gray-900">{shown}</span> من <span className="font-bold text-gray-900">{total}</span>
        </p>

        {!allShown && (
          <div className="flex gap-2">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a1a2e] hover:bg-[#2d1060] text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : `تحميل ${Math.min(step, remaining)} المزيد`}
            </button>
            <button
              onClick={onLoadAll}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              عرض الكل ({total})
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pagebar {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
