import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const errorPrimary =
  "inline-flex h-11 items-center justify-center rounded-xl bg-[#F2B632] px-5 text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F]";

export const errorGhost =
  "inline-flex h-11 items-center justify-center rounded-xl border border-gray-300 px-5 text-base font-medium outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632]";

export function ErrorScreen({
  code,
  title,
  text,
  icon: Icon,
  reference,
  compact = false,
  children,
}: {
  code: string;
  title: string;
  text: string;
  icon: LucideIcon;
  reference?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const body = (
    <div className="mx-auto w-full max-w-md text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-gray-100 text-[#12343B] dark:bg-white/10 dark:text-[#EEF3F4]">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <p className="mt-6 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-widest text-gray-600 dark:text-[#9FB3B7]">
        <span aria-hidden="true" className="mr-2 inline-block h-3 w-1.5 rounded-full bg-[#F2B632] align-middle" />
        {code}
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-[#9FB3B7]">{text}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
      {reference && (
        <p className="mt-8 text-xs text-gray-600 dark:text-[#9FB3B7]">
          Reference: <span className="font-[family-name:var(--font-geist-mono)]">{reference}</span>
        </p>
      )}
    </div>
  );

  if (compact) return <div className="px-4 py-16 text-[#12343B] dark:text-[#EEF3F4]">{body}</div>;

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-4 py-16 text-[#12343B] dark:bg-[#0B1B1F] dark:text-[#EEF3F4]">
      {body}
    </main>
  );
}
