"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { ErrorScreen, errorGhost, errorPrimary } from "@/components/errors/error-screen";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] Unhandled error", error);
  }, [error]);

  return (
    <ErrorScreen
      compact
      code="Something went wrong"
      icon={TriangleAlert}
      title="This page failed to load"
      text="Check that the database and providers are reachable, then try again. Use the reference below to find the log entry."
      reference={error.digest}
    >
      <button type="button" onClick={reset} className={errorPrimary}>
        Try again
      </button>
      <Link href="/admin" className={errorGhost}>
        Back to overview
      </Link>
    </ErrorScreen>
  );
}
