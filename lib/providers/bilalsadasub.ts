import "server-only";
import { getProviderForCall, listDataPlanCatalogProviderIds } from "@/lib/db/providers";
import { getLoginToken } from "@/lib/providers/login";

export type BilalsadasubNetwork = { name: string; id: string };
export type ProviderDataPlanCatalogRow = {
  providerId: string;
  planId: string;
  network: string;
  planName: string;
  planType: string;
  planDay: string;
  amount: number;
};

export async function getDataPlanCatalogs(): Promise<{
  providerIds: string[];
  plans: ProviderDataPlanCatalogRow[];
}> {
  const providerIds = await listDataPlanCatalogProviderIds();
  if (providerIds.length === 0) {
    throw new Error("Add and activate a Data plan catalog endpoint for at least one provider.");
  }
  const catalogs = await Promise.all(
    providerIds.map(async (providerId) => {
      try {
        return await getProviderDataPlans(providerId);
      } catch (error) {
        throw new Error(
          `Could not fetch data plans from ${providerId}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }),
  );
  return { providerIds, plans: catalogs.flat() };
}

async function getProviderDataPlans(providerId: string): Promise<ProviderDataPlanCatalogRow[]> {
  const provider = await getProviderForCall(providerId, "data_plans", true);
  if (!provider) throw new Error("The data plan catalog endpoint is unavailable.");
  if (provider.method !== "GET") throw new Error("Data plan catalog endpoints must use GET.");

  const url = new URL(provider.path, provider.baseUrl);
  const request = async (freshToken = false) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    switch (provider.authType) {
      case "bearer":
        headers.Authorization = `Bearer ${provider.secret}`;
        break;
      case "api_key_header":
        headers[provider.authName] = provider.secret;
        break;
      case "basic":
        headers.Authorization = `Basic ${Buffer.from(`${provider.authUsername}:${provider.secret}`).toString("base64")}`;
        break;
      case "query_param":
        url.searchParams.set(provider.authName, provider.secret);
        break;
      case "login":
        headers.Authorization = `${provider.authName || "Bearer"} ${await getLoginToken(providerId, freshToken, true)}`;
        break;
    }
    return fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(provider.timeoutMs),
    });
  };
  let response = await request();
  if (response.status === 401 && provider.authType === "login") response = await request(true);
  if (!response.ok) throw new Error(`Catalog returned HTTP ${response.status}.`);

  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error("The provider returned an invalid data plan catalog response.");
  }
  const body = asRecord(payload);
  if (body?.status !== "success" || !Array.isArray(body.data)) {
    throw new Error("The provider returned an unexpected data plan catalog response.");
  }
  let invalidCount = 0;
  const plans = body.data.flatMap((item) => {
    const plan = asRecord(item);
    const planId = plan?.plan_id;
    const network = plan?.network;
    const planName = plan?.plan_name;
    const planType = plan?.plan_type;
    const planDay = plan?.plan_day;
    const amount = plan?.amount;
    const cost =
      typeof amount === "number"
        ? amount
        : typeof amount === "string" && amount.trim()
          ? Number(amount)
          : null;
    const id =
      typeof planId === "number" && Number.isSafeInteger(planId) && planId > 0
        ? String(planId)
        : typeof planId === "string" && planId.trim().length <= 100
          ? planId.trim() || null
          : null;
    if (
      !id ||
      typeof network !== "string" ||
      !network.trim() ||
      typeof planName !== "string" ||
      !planName.trim() ||
      typeof planType !== "string" ||
      !planType.trim() ||
      typeof planDay !== "string" ||
      !planDay.trim() ||
      cost === null ||
      !Number.isFinite(cost) ||
      cost < 0
    ) {
      invalidCount += 1;
      return [];
    }
    return [{
      providerId,
      planId: id,
      network: network.trim(),
      planName: planName.trim(),
      planType: planType.trim(),
      planDay: planDay.trim(),
      amount: cost,
    }];
  });
  if (invalidCount > 0) {
    throw new Error(`Catalog contains ${invalidCount} invalid data plan entr${invalidCount === 1 ? "y" : "ies"}.`);
  }
  return plans;
}

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

