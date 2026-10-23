"use server";

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; field?: "phone" | "password" };

/**
 * Stub: replace the body with your real auth call (database lookup, session
 * cookie, rate limiting). Re-validate `phone` here; the client check is only
 * for convenience. Use one generic message for wrong phone and wrong password
 * so the form doesn't reveal which numbers have accounts.
 */
export async function loginAction(input: { phone: string; password: string }): Promise<LoginResult> {
  if (!/^0[789][01]\d{8}$/.test(input.phone) || !input.password) {
    return { ok: false, error: "Check your phone number and password, then try again." };
  }

  // TODO: authenticate, create the session, then:
  // return { ok: true, redirectTo: "/dashboard" };
  return { ok: false, error: "Login isn't connected yet." };
}