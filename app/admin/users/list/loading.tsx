export default function CustomersLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" role="status" aria-live="polite">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
      <div className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
      <div className="h-80 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
      <span className="sr-only">Loading customers...</span>
    </div>
  );
}
