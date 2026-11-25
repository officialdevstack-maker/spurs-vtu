export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-dvh place-items-center bg-[#EEF3F4] text-[#12343B] dark:bg-[#0B1B1F] dark:text-[#EEF3F4]"
    >
      <span className="sr-only">Loading Spur VTU</span>
      <div aria-hidden="true" className="flex flex-col items-center gap-5">
        <span className="grid size-14 animate-pulse place-items-center rounded-2xl bg-[#F2B632] font-[family-name:var(--font-display)] text-2xl font-bold text-[#12343B] motion-reduce:animate-none">
          S
        </span>
        <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">Spur VTU</span>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-[#12343B]/10 dark:bg-white/10">
          <div className="splash-bar h-full w-1/2 animate-[splash_1s_ease-in-out_infinite] rounded-full bg-[#F2B632]" />
        </div>
      </div>
    </div>
  );
}
