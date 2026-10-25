"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { ErrorScreen, errorGhost, errorPrimary } from "@/components/errors/error-screen";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard] Unhandled error", error);
  }, [error]);

  return (
    <ErrorScreen
      compact
      code="Something went wrong"
      icon={TriangleAlert}
      title="We couldn't load this page"
      text="Your wallet and purchases are safe. Try again, and check your transaction history before repeating a purchase."
      reference={error.digest}
    >
      <button type="button" onClick={reset} className={errorPrimary}>
        Try again
      </button>
      <Link href="/dashboard/transactions" className={errorGhost}>
        View transactions
      </Link>
    </ErrorScreen>
  );
}
