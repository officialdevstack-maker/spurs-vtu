import "server-only";
import { getProviderForCall } from "@/lib/db/providers";
import type { ProviderService, ResponseMap } from "@/lib/admin/providers";
import { fill, type Vars } from "@/lib/providers/fill";
import { getLoginToken } from "@/lib/providers/login";

export class NotSentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NotSentError";
  }
}

export type ProviderResponse = { ok: boolean; status: number; data: unknown; map?: ResponseMap };

type Prepared = {
  url: URL;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  login: boolean;
  secretParam?: string;
  map: ResponseMap;
};

function providerCode(value: string): string | number {
  const numeric = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(numeric) ? numeric : value;
}

async function prepare(providerId: string, service: ProviderService, vars: Vars, freshToken: boolean): Promise<Prepared> {
  try {
    const provider = await getProviderForCall(providerId, service);
    if (!provider) throw new Error("Provider is off or has no active endpoint for this service.");

    const resolvedVars: Vars = { ...vars };
    const networkId =
      typeof resolvedVars.network === "string" || typeof resolvedVars.network === "number"
        ? String(resolvedVars.network)
        : undefined;
    if (networkId && provider.networkCodes[networkId] !== undefined) {
      resolvedVars.network = providerCode(provider.networkCodes[networkId]);
    }
    const operatorId =
      typeof resolvedVars.operator === "string" ? resolvedVars.operator : undefined;
    if (operatorId && provider.cableCodes[operatorId] !== undefined) {
      resolvedVars.operator = providerCode(provider.cableCodes[operatorId]);
    }
    if (
      (service === "data" || service === "cable") &&
      typeof resolvedVars.plan === "string"
    ) {
      resolvedVars.plan = providerCode(resolvedVars.plan);
    }

    const url = new URL(`${provider.baseUrl}${fill(provider.path, resolvedVars, "path")}`);
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
        headers.Authorization = `${provider.authName || "Bearer"} ${await getLoginToken(providerId, freshToken)}`;
        break;
    }

    let body: string | undefined;
    if (provider.method === "POST") {
      headers["Content-Type"] = "application/json";
      body = provider.bodyTemplate ? fill(provider.bodyTemplate, resolvedVars, "body") : undefined;
    }

    return {
      url,
      method: provider.method,
      headers,
      body,
      timeoutMs: provider.timeoutMs,
      login: provider.authType === "login",
      secretParam: provider.authType === "query_param" ? provider.authName : undefined,
      map: provider.responseMap,
    };
  } catch (error) {
    throw new NotSentError(error instanceof Error ? error.message : "Could not prepare the provider request.", { cause: error });
  }
}

async function execute(request: Prepared): Promise<ProviderResponse> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(request.timeoutMs),
  });

  const shown = new URL(request.url);
  if (request.secretParam) shown.searchParams.delete(request.secretParam);
  console.info(
    `[provider-call] ${request.method} ${shown.pathname}${shown.search ? " (query redacted)" : ""}`,
  );

  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
    console.log(`Call ${request.url}:`, data);
  } catch (error) {
    console.warn(`Call ${request.url} returned non-JSON response:`, text, error);
    if (!(error instanceof SyntaxError)) throw error;
  }
  return { ok: response.ok, status: response.status, data };
}

export async function callProviderEndpoint(
  providerId: string,
  service: ProviderService,
  vars: Vars,
): Promise<ProviderResponse> {
  let request = await prepare(providerId, service, vars, false);
  let response = await execute(request);
  if (request.login && response.status === 401) {
    request = await prepare(providerId, service, vars, true);
    response = await execute(request);
  }
  return { ...response, map: request.map };
}
