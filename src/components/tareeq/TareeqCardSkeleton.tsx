export default function TareeqCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse" aria-hidden="true">
      {/* Media slot */}
      <div className="w-full bg-gray-200" style={{ aspectRatio: '4/3' }} />

      <div className="p-5 space-y-3">
        {/* Author row */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 bg-gray-200 rounded-full w-24" />
            <div className="h-2 bg-gray-100 rounded-full w-16" />
          </div>
        </div>

        {/* Title */}
        <div className="h-4 bg-gray-200 rounded-full w-4/5" />

        {/* Content lines */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded-full w-full" />
          <div className="h-3 bg-gray-100 rounded-full w-full" />
          <div className="h-3 bg-gray-100 rounded-full w-3/5" />
        </div>

        {/* Footer — 3 actions */}
        <div className="border-t border-gray-50 pt-3 flex items-center gap-4">
          <div className="h-3 w-10 bg-gray-100 rounded-full" />
          <div className="h-3 w-10 bg-gray-100 rounded-full" />
          <div className="h-3 w-8 bg-gray-100 rounded-full ms-auto" />
        </div>
      </div>
    </div>
  );
}
