import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getPinState } from "@/lib/db/pin";
import { PIN_SETUP_PATH } from "@/lib/pin";
import { getSpursUser } from "@/lib/spurs";

export async function PinGate({ children }: { children: ReactNode }) {
  await connection();
  const user = await getSpursUser();
  if (user) {
    const state = await getPinState(user.sub);
    if (state.required && !state.hasPin) redirect(PIN_SETUP_PATH);
  }
  return <>{children}</>;
}
