import "server-only";
import { getProviderForCall } from "@/lib/db/providers";
import { getLoginToken } from "@/lib/providers/login";

export type BilalsadasubNetwork = { name: string; id: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function getBilalsadasubNetworks(): Promise<BilalsadasubNetwork[]> {
  const provider = await getProviderForCall("bilalsadasub", "networks", true);
  if (!provider) {
    throw new Error("Bilalsadasub needs an active Network catalog endpoint before networks can be fetched.");
  }
  if (provider.method !== "GET") {
    throw new Error("Bilalsadasub's Network catalog endpoint must use GET.");
  }

  const url = new URL(provider.path, provider.baseUrl);
  const request = (token: string) =>
    fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `${provider.authName || "Bearer"} ${token}`,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  let response = await request(await getLoginToken("bilalsadasub", false, true));
  if (response.status === 401) {
    response = await request(await getLoginToken("bilalsadasub", true, true));
  }
  if (!response.ok) {
    throw new Error(`Bilalsadasub network catalog returned HTTP ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error("Bilalsadasub returned an invalid network catalog response.");
  }

  const body = asRecord(payload);
  const data = body?.data;
  if (body?.status !== "success" || !Array.isArray(data)) {
    throw new Error("Bilalsadasub returned an unexpected network catalog response.");
  }

  return data.flatMap((item) => {
    const network = asRecord(item);
    const name = network?.network;
    const planId = network?.plan_id;
    const id =
      typeof planId === "number" && Number.isSafeInteger(planId) && planId > 0
        ? String(planId)
        : typeof planId === "string" && /^\d+$/.test(planId)
          ? planId
          : null;
    return typeof name === "string" && name.trim() && id
      ? [{ name: name.trim(), id }]
      : [];
  });
}
