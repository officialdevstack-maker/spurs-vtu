import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FundWalletLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
