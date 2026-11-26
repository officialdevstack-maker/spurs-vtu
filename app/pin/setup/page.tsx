import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PinSetupForm } from "@/components/pin/pin-setup-form";
import { getPinState } from "@/lib/db/pin";
import { requireSpursUser } from "@/lib/spurs";

export const metadata: Metadata = { title: "Set your PIN | Spur VTU" };

export default async function PinSetupPage() {
  await connection();
  const user = await requireSpursUser();
  if ((await getPinState(user.sub)).hasPin) redirect("/dashboard/profile");
  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Set your PIN</h1>
      <p className="mt-1 mb-5 text-sm text-gray-600 dark:text-[#9FB3B7]">
        Choose a 4-digit PIN. You'll enter it to confirm every purchase.
      </p>
      <PinSetupForm />
    </>
  );
}
