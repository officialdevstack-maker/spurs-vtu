import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { PinGate } from "@/components/dashboard/pin-gate";
import { DashboardSkeleton } from "@/components/ui/skeletons";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout>
      <Suspense fallback={<DashboardSkeleton />}>
        <PinGate>{children}</PinGate>
      </Suspense>
    </DashboardLayout>
  );
}