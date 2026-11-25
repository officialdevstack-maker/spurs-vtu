import type { ReactNode } from "react";

const bone = "animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/10";

export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`${bone} ${className}`} />;
}

function Status({ label, children, className = "mx-auto max-w-6xl space-y-6" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Title, optional filter bar, and a table-sized block. */
export function ListPageSkeleton({ label, filters = true }: { label: string; filters?: boolean }) {
  return (
    <Status label={label}>
      <Bone className="h-9 w-56" />
      {filters && <Bone className="h-16 w-full rounded-2xl" />}
      <Bone className="h-80 w-full rounded-2xl" />
    </Status>
  );
}

/** Title and a single form card. */
export function FormPageSkeleton({ label }: { label: string }) {
  return (
    <Status label={label}>
      <Bone className="h-9 w-56" />
      <Bone className="h-96 w-full max-w-xl rounded-2xl" />
    </Status>
  );
}

/** Customer dashboard home. */
export function DashboardSkeleton() {
  return (
    <Status label="Loading dashboard" className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2">
        <Bone className="h-9 w-72" />
        <Bone className="h-5 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Bone className="h-32 rounded-2xl" />
        <Bone className="h-32 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Bone className="h-80 rounded-2xl" />
        <div className="space-y-8">
          <Bone className="h-40 rounded-2xl" />
          <Bone className="h-40 rounded-2xl" />
        </div>
      </div>
    </Status>
  );
}

/** Admin overview. */
export function OverviewSkeleton() {
  return (
    <Status label="Loading overview" className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2">
        <Bone className="h-9 w-40" />
        <Bone className="h-5 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Bone className="h-80 rounded-2xl" />
        <Bone className="h-80 rounded-2xl" />
      </div>
    </Status>
  );
}

/** Whole admin workspace: sidebar plus content. Used while auth and permissions resolve. */
export function AdminShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-white dark:bg-[#0B1B1F]" role="status" aria-live="polite">
      <span className="sr-only">Loading admin workspace</span>
      <aside aria-hidden="true" className="hidden w-64 shrink-0 space-y-3 border-r border-gray-200 p-5 dark:border-white/10 lg:block">
        <Bone className="mb-6 h-9 w-36" />
        {Array.from({ length: 7 }, (_, i) => (
          <Bone key={i} className="h-9 w-full" />
        ))}
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div aria-hidden="true" className="mx-auto max-w-6xl space-y-6">
          <Bone className="h-9 w-56" />
          <Bone className="h-80 w-full rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
