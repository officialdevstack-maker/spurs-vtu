export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading airtime and data settings</span>
      <div className="h-9 w-56 animate-pulse rounded-lg bg-gray-100 dark:bg-white/10" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
      <div className="h-64 w-full animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
    </div>
  );
}
