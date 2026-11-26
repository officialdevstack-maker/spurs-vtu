import "server-only";
import { callProviderEndpoint } from "@/lib/providers/call";
import { interpretProviderResponse } from "@/lib/providers/result";

export type Requery = { outcome: "success" | "failed" | "pending" | "unknown"; response: string };

export async function requeryOrder(providerId: string, reference: string): Promise<Requery> {
  try {
    const result = await callProviderEndpoint(providerId, "status", { reference });
    const response = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
    if (!result.ok) return { outcome: "unknown", response };
    return { outcome: interpretProviderResponse(result), response };
  } catch (error) {
    console.error("[reconcile] Requery did not complete", reference, error instanceof Error ? error.message : error);
    return { outcome: "unknown", response: "" };
  }
}
