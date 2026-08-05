export default function TareeqCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-5 space-y-3 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
        <div className="space-y-1 flex-1">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-2 bg-gray-100 rounded w-16" />
        </div>
        <div className="h-4 w-14 bg-gray-100 rounded-full" />
      </div>
      {/* Title */}
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      {/* Content lines */}
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
      {/* Footer */}
      <div className="flex gap-4 pt-2">
        <div className="h-3 w-10 bg-gray-100 rounded" />
        <div className="h-3 w-10 bg-gray-100 rounded" />
      </div>
    </div>
  );
}
