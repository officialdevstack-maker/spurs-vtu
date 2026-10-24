import "server-only";
import { getProviderForCall } from "@/lib/db/providers";
import type { ProviderService } from "@/lib/admin/providers";

type Vars = Record<string, string | number>;

function fill(template: string, vars: Vars, mode: "body" | "path"): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) throw new Error(`Missing value for {${key}}.`);
    if (mode === "path") return encodeURIComponent(String(value));
    return typeof value === "number" ? String(value) : JSON.stringify(value);
  });
}

export type ProviderResponse = { ok: boolean; status: number; data: unknown };

export async function callProviderEndpoint(
  providerId: string,
  service: ProviderService,
  vars: Vars,
): Promise<ProviderResponse> {
  const provider = await getProviderForCall(providerId, service);
  if (!provider) throw new Error("Provider is off or has no active endpoint for this service.");

  const url = new URL(`${provider.baseUrl}${fill(provider.path, vars, "path")}`);
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
  }

  let body: string | undefined;
  if (provider.method === "POST") {
    headers["Content-Type"] = "application/json";
    body = provider.bodyTemplate ? fill(provider.bodyTemplate, vars, "body") : undefined;
  }

  const response = await fetch(url, {
    method: provider.method,
    headers,
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(provider.timeoutMs),
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  return { ok: response.ok, status: response.status, data };
}
