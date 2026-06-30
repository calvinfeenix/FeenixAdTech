/**
 * Route-level loading UI for every authenticated page. Next renders this
 * INSTANTLY on navigation (the sidebar/header stay mounted) while the target
 * page's server data resolves — so switching tabs feels immediate instead of
 * blocking on the fetch. Links are also prefetched by default.
 */
export default function Loading() {
  return (
    <div className="space-y-6 fade-up">
      <div className="h-9 w-56 rounded-lg bg-card animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[110px] rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-card border border-border animate-pulse" />
    </div>
  );
}
