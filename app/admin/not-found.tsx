import Link from "next/link";
import { SearchX } from "lucide-react";
import { ErrorScreen, errorPrimary } from "@/components/errors/error-screen";

export default function AdminNotFound() {
  return (
    <ErrorScreen
      compact
      code="Error 404"
      icon={SearchX}
      title="Page not found"
      text="This page doesn't exist, or your role doesn't have access to it. Ask an owner to update your role if you need it."
    >
      <Link href="/admin" className={errorPrimary}>
        Back to overview
      </Link>
    </ErrorScreen>
  );
}
