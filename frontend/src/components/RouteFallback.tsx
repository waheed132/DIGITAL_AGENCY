/**
 * Shown only while a lazy route chunk loads (first visit per area).
 * Keep minimal: same background as the app shell to avoid a white flash.
 */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#070b14] font-sans text-slate-400"
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )
}
