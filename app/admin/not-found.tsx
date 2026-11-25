import Link from "next/link";
import { errorPrimary } from "@/components/errors/error-screen";
import { FeedbackState } from "@/components/ui/feedback-state";

export default function AdminNotFound() {
  return (
    <FeedbackState
      kind="not-found"
      compact
      title="Page not found"
      description="This page doesn't exist, or your role doesn't have access to it. Ask an owner to update your role if you need it."
    >
      <Link href="/admin" className={errorPrimary}>
        Back to overview
      </Link>
    </FeedbackState>
  );
}
