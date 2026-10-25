"use client";

import { useEffect } from "react";
import { ServerCrash } from "lucide-react";
import { ErrorScreen, errorGhost, errorPrimary } from "@/components/errors/error-screen";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global] Root layout error", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ErrorScreen
          code="Something went wrong"
          icon={ServerCrash}
          title="Spur VTU hit a problem"
          text="Please try again in a moment. If you were in the middle of a purchase, check your transaction history before repeating it."
          reference={error.digest}
        >
          <button type="button" onClick={reset} className={errorPrimary}>
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={errorGhost}>
            Back to home
          </a>
        </ErrorScreen>
      </body>
    </html>
  );
}
