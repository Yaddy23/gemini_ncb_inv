/**
 * Shimmering placeholder block. Size it with utility classes, e.g.
 *   <Skeleton className="h-4 w-32" />
 * The sweep animation lives in index.css (.skeleton-shimmer) and is
 * disabled globally under prefers-reduced-motion.
 */
export default function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton-shimmer rounded bg-gray-200 dark:bg-slate-700 ${className}`} />;
}
