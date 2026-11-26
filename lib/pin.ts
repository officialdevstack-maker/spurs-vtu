export const PIN_PATTERN = /^\d{4}$/;
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const PIN_SETUP_PATH = "/pin/setup";
export const PIN_RESET_PATH = "/pin/reset";

const WEAK = new Set(["1234", "4321", "0123", "3210"]);

export function pinProblem(pin: unknown): string | null {
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) return "Enter a 4-digit PIN.";
  if (/^(\d)\1{3}$/.test(pin) || WEAK.has(pin)) return "That PIN is too easy to guess. Choose another.";
  return null;
}

export type PinResult = { ok: true } | { ok: false; error: string };
