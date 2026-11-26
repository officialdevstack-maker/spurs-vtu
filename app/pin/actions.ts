"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { changePin, createResetToken, getPinState, removePin, resetPinWithToken, setInitialPin } from "@/lib/db/pin";
import { sendEmail } from "@/lib/messaging/send";
import { notify } from "@/lib/notify";
import { PIN_RESET_PATH, pinProblem, type PinResult } from "@/lib/pin";
import { requireSpursUser } from "@/lib/spurs";

const fail = (error: string): PinResult => ({ ok: false, error });
const WRONG = fail("Something went wrong. Try again.");

const tell = (customerId: string, title: string, body: string) =>
  notify(customerId, { id: `pin-${randomUUID()}`, category: "security", title, body });

function refresh() {
  revalidatePath("/dashboard", "layout");
}

export async function setupPin(pin: unknown): Promise<PinResult> {
  const user = await requireSpursUser();
  const problem = pinProblem(pin);
  if (problem) return fail(problem);
  try {
    if (!(await setInitialPin(user.sub, pin as string))) return fail("You already have a PIN. Change it from your profile.");
    await tell(user.sub, "Transaction PIN set", "You'll enter this PIN to confirm purchases.");
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[pin] setup", error);
    return WRONG;
  }
}

export async function changePinAction(current: unknown, next: unknown): Promise<PinResult> {
  const user = await requireSpursUser();
  const problem = pinProblem(next);
  if (problem) return fail(problem);
  try {
    if (!(await getPinState(user.sub)).hasPin) return fail("You don't have a PIN yet.");
    const result = await changePin(user.sub, current, next as string);
    if (result.ok) await tell(user.sub, "Transaction PIN changed", "If this wasn't you, reset your PIN and contact support.");
    refresh();
    return result;
  } catch (error) {
    console.error("[pin] change", error);
    return WRONG;
  }
}

export async function removePinAction(current: unknown): Promise<PinResult> {
  const user = await requireSpursUser();
  try {
    const result = await removePin(user.sub, current);
    if (result.ok) await tell(user.sub, "Transaction PIN turned off", "Purchases no longer ask for a PIN. Turn it back on from your profile.");
    refresh();
    return result;
  } catch (error) {
    console.error("[pin] remove", error);
    return WRONG;
  }
}

export async function requestPinReset(): Promise<PinResult> {
  const user = await requireSpursUser();
  if (!user.email) return fail("Add an email address to your Spurs account first.");
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (!base) return fail("Reset emails aren't available right now.");
  try {
    const token = await createResetToken(user.sub);
    if (!token) return fail("A reset link was just sent. Check your email, or wait a minute and try again.");
    await sendEmail(
      user.email,
      "Reset your Spur VTU PIN",
      `Use this link to choose a new transaction PIN. It works once and expires in 30 minutes.\n\n${base}${PIN_RESET_PATH}?token=${token}\n\nIf you didn't ask for this, ignore this email. Your PIN has not changed.`,
    );
    return { ok: true };
  } catch (error) {
    console.error("[pin] reset request", error);
    return fail("We couldn't send the email. Try again.");
  }
}

export async function resetPinAction(token: unknown, pin: unknown): Promise<PinResult> {
  const user = await requireSpursUser();
  const problem = pinProblem(pin);
  if (problem) return fail(problem);
  if (typeof token !== "string") return fail("Check your details and try again.");
  try {
    if (!(await resetPinWithToken(user.sub, token, pin as string))) {
      return fail("This reset link has expired or was already used. Request a new one.");
    }
    await tell(user.sub, "Transaction PIN reset", "Your PIN was reset from an emailed link. If this wasn't you, contact support.");
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[pin] reset", error);
    return WRONG;
  }
}
