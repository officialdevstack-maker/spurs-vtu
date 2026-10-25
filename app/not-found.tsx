import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { ErrorScreen, errorGhost, errorPrimary } from "@/components/errors/error-screen";

export const metadata: Metadata = { title: "Page not found | Spur VTU" };

export default function NotFound() {
  return (
    <ErrorScreen
      code="Error 404"
      icon={Compass}
      title="We can't find that page"
      text="The link may be old, or the page may have moved. If you typed the address, check it for typos."
    >
      <Link href="/dashboard" className={errorPrimary}>
        Go to dashboard
      </Link>
      <Link href="/" className={errorGhost}>
        Back to home
      </Link>
    </ErrorScreen>
  );
}
