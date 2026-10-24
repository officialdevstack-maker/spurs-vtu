import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSpursUser } from "@spurs-cloud/accounts/next";
import { SpursSignInButton } from "@spurs-cloud/accounts/react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F]";

const linkStyles: Record<Variant, string> = {
  primary: "bg-[#F2B632] text-[#12343B] hover:bg-[#E5A720]",
  secondary:
    "border border-gray-300 text-[#12343B] hover:bg-gray-100 dark:border-white/15 dark:text-[#EEF3F4] dark:hover:bg-white/10",
};

const buttonStyle = (variant: Variant, compact: boolean) => ({
  justifyContent: "center",
  height: compact ? 40 : 52,
  padding: compact ? "0 16px" : "0 24px",
  fontSize: compact ? 14 : 16,
  fontWeight: 600,
  borderRadius: 12,
  ...(variant === "primary"
    ? { background: "#F2B632", color: "#12343B" }
    : { background: "#ffffff", color: "#12343B", border: "1px solid #BFCFD2" }),
});

function sizeClass(compact: boolean) {
  return compact ? "h-10 px-4 text-sm" : "h-[52px] px-6 text-base";
}

/** Fallback shown while we check the session (and for the prerendered shell). */
export function AuthButtonFallback({
  label = "Get started",
  variant = "primary",
  compact = false,
}: {
  label?: string;
  variant?: Variant;
  compact?: boolean;
}) {
  return (
    <Link href="/login" className={`${base} ${linkStyles[variant]} ${sizeClass(compact)}`}>
      {label}
    </Link>
  );
}

export async function AuthButton({
  label = "Get started",
  variant = "primary",
  compact = false,
}: {
  label?: string;
  variant?: Variant;
  compact?: boolean;
}) {
  const user = await getSpursUser();

  if (user) {
    return (
      <Link href="/dashboard" className={`${base} ${linkStyles[variant]} ${sizeClass(compact)}`}>
        Go to dashboard
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <SpursSignInButton
      issuer={process.env.SPURS_ISSUER}
      returnTo="/dashboard"
      style={buttonStyle(variant, compact)}
    >
      {label}
    </SpursSignInButton>
  );
}
