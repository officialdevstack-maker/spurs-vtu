import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PinLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#EEF3F4] p-4 text-[#12343B] dark:bg-[#0B1B1F] dark:text-[#EEF3F4]">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        {children}
      </div>
    </main>
  );
}
