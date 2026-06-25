/** A grid of placeholder match cards shown while fixtures load — keeps layout from jumping. */
export function MatchGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="match-grid" aria-hidden="true" data-testid="fixtures-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}
