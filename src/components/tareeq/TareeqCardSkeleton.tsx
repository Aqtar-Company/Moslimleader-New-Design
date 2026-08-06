export default function TareeqCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      aria-hidden="true"
      style={{ background: 'var(--tr-surface)', border: '1px solid var(--tr-border-subtle)' }}
    >
      {/* Accent line placeholder */}
      <div style={{ height: 2, background: 'var(--tr-border-subtle)' }} />

      {/* Media slot */}
      <div style={{ aspectRatio: '4/3', background: 'var(--tr-raised)' }} />

      <div className="p-5 space-y-3">
        {/* Author row */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full shrink-0" style={{ background: 'var(--tr-overlay)' }} />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 rounded-full w-24" style={{ background: 'var(--tr-overlay)' }} />
            <div className="h-2 rounded-full w-16" style={{ background: 'var(--tr-raised)' }} />
          </div>
        </div>

        {/* Title */}
        <div className="h-4 rounded-full w-4/5" style={{ background: 'var(--tr-overlay)' }} />

        {/* Content lines */}
        <div className="space-y-2">
          <div className="h-3 rounded-full w-full" style={{ background: 'var(--tr-raised)' }} />
          <div className="h-3 rounded-full w-full" style={{ background: 'var(--tr-raised)' }} />
          <div className="h-3 rounded-full w-3/5" style={{ background: 'var(--tr-raised)' }} />
        </div>

        {/* Footer */}
        <div className="pt-3 flex items-center gap-4" style={{ borderTop: '1px solid var(--tr-border-subtle)' }}>
          <div className="h-3 w-10 rounded-full" style={{ background: 'var(--tr-raised)' }} />
          <div className="h-3 w-10 rounded-full" style={{ background: 'var(--tr-raised)' }} />
          <div className="h-3 w-8 rounded-full ms-auto" style={{ background: 'var(--tr-raised)' }} />
        </div>
      </div>
    </div>
  );
}
