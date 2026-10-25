"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { ErrorScreen, errorGhost, errorPrimary } from "@/components/errors/error-screen";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] Unhandled error", error);
  }, [error]);

  return (
    <ErrorScreen
      code="Something went wrong"
      icon={TriangleAlert}
      title="That didn't work"
      text="It's on our side, not yours. Try again, and if it keeps happening, check your history before repeating a purchase."
      reference={error.digest}
    >
      <button type="button" onClick={reset} className={errorPrimary}>
        Try again
      </button>
      <Link href="/" className={errorGhost}>
        Back to home
      </Link>
    </ErrorScreen>
  );
}
