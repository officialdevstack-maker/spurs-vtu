import type { Metadata } from "next";
import Link from "next/link";
import { errorGhost, errorPrimary } from "@/components/errors/error-screen";
import { FeedbackState } from "@/components/ui/feedback-state";

export const metadata: Metadata = { title: "Page not found | Spur VTU" };

export default function NotFound() {
  return (
    <FeedbackState kind="not-found">
      <Link href="/dashboard" className={errorPrimary}>
        Go to dashboard
      </Link>
      <Link href="/" className={errorGhost}>
        Back to home
      </Link>
    </FeedbackState>
  );
}
