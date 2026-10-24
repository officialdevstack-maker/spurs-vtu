import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSpursUser } from "@spurs-cloud/accounts/next";

function adminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_SPURS_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/** Missing or empty ADMIN_SPURS_IDS deliberately grants access to nobody. */
export const requireAdmin = cache(async () => {
  const user = await requireSpursUser();
  if (!adminIds().has(user.sub)) notFound();
  return user;
});
