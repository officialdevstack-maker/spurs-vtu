import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PinSetupForm } from "@/components/pin/pin-setup-form";
import { peekResetToken } from "@/lib/db/pin";
import { requireSpursUser } from "@/lib/spurs";

export const metadata: Metadata = { title: "Reset your PIN | Spur VTU", referrer: "no-referrer" };

export default async function PinResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await connection();
  const user = await requireSpursUser();
  const { token } = await searchParams;
  const valid = typeof token === "string" && (await peekResetToken(user.sub, token));

  if (!valid) {
    return (
      <>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Link not valid</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">
          This reset link has expired, was already used, or belongs to another account.
        </p>
        <Link href="/dashboard/profile" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
          Request a new one from your profile
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Choose a new PIN</h1>
      <p className="mt-1 mb-5 text-sm text-gray-600 dark:text-[#9FB3B7]">This replaces your old PIN straight away.</p>
      <PinSetupForm token={token} />
    </>
  );
}
