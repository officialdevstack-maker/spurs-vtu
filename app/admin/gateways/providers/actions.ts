"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/auth";
import { AUTH_TYPES, KINDS, PROVIDERS_PATH, PROVIDER_SERVICES, type HttpMethod } from "@/lib/admin/providers";
import { slugify } from "@/lib/admin/airtime-data";
import * as db from "@/lib/db/providers";
import type { EndpointFields, ProviderFields } from "@/lib/db/providers";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const BAD_INPUT = fail("That change isn't valid. Refresh the page and try again.");
const NOT_FOUND = fail("That item no longer exists. Refresh the page.");

const clean = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

function databaseCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function dbError(error: unknown): ActionResult {
  const code = databaseCode(error);
  if (code === "23505") return fail("That already exists. Try a different name.");
  if (code === "23503") return fail("That provider no longer exists. Refresh the page.");
  console.error("[providers]", error);
  return fail("Something went wrong saving that. Try again.");
}

async function run(fn: () => Promise<boolean>, id?: string): Promise<ActionResult> {
  try {
    if (!(await fn())) return NOT_FOUND;
    revalidatePath(PROVIDERS_PATH);
    return { ok: true, id };
  } catch (error) {
    return dbError(error);
  }
}

function parseProvider(input: unknown, isNew: boolean): ProviderFields | string {
  if (!input || typeof input !== "object") return "Check the provider details and try again.";
  const raw = input as Partial<ProviderFields>;

  const name = clean(raw.name);
  if (!name || name.length > 40 || !slugify(name)) {
    return "Enter a name using letters or numbers, up to 40 characters.";
  }

  const kind = KINDS.find((item) => item.id === raw.kind)?.id;
  if (!kind) return "Choose a provider type.";

  const authType = AUTH_TYPES.find((item) => item.id === raw.authType);
  if (!authType) return "Choose how this provider authenticates.";

  let baseUrl = clean(raw.baseUrl);
  try {
    const url = new URL(baseUrl);
    const allowedProtocols = kind === "simhost" ? ["https:", "http:"] : ["https:"];
    if (!allowedProtocols.includes(url.protocol)) {
      return kind === "simhost" ? "Use an http:// or https:// address." : "Third-party APIs must use https://.";
    }
    if (url.username || url.password) return "Don't put credentials in the address. Use the fields below.";
    if (url.search || url.hash) return "The base address can't include a query string or fragment.";
    baseUrl = url.toString().replace(/\/+$/, "");
  } catch {
    return "Enter a full address, like https://api.example.com.";
  }

  const authName = clean(raw.authName);
  if (authType.extra === "name" && !/^[A-Za-z0-9_-]{1,40}$/.test(authName)) {
    return `Enter the ${authType.extraLabel?.toLowerCase()} using letters, numbers, - or _.`;
  }

  const authUsername = clean(raw.authUsername);
  if (authType.extra === "username" && (!authUsername || authUsername.length > 100)) {
    return "Enter the username, up to 100 characters.";
  }

  const secret = typeof raw.secret === "string" ? raw.secret.trim() : "";
  if (secret.length > 500) return "That secret is too long.";
  if (isNew && authType.id !== "none" && !secret) return `Enter the ${authType.secretLabel.toLowerCase()}.`;

  const priority = Number(raw.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 999) {
    return "Priority must be a whole number from 1 to 999.";
  }

  const timeoutMs = Number(raw.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    return "Timeout must be between 1,000 and 60,000 milliseconds.";
  }

  if (typeof raw.enabled !== "boolean") return "Check the provider details and try again.";

  return {
    name,
    kind,
    baseUrl,
    authType: authType.id,
    authName: authType.extra === "name" ? authName : "",
    authUsername: authType.extra === "username" ? authUsername : "",
    secret: authType.id === "none" ? "" : secret,
    enabled: raw.enabled,
    priority,
    timeoutMs,
  };
}

export async function createProvider(input: ProviderFields): Promise<ActionResult> {
  await requirePermission("gateways.manage");
  const provider = parseProvider(input, true);
  if (typeof provider === "string") return fail(provider);
  const id = slugify(provider.name);
  return run(() => db.createProvider(id, provider), id);
}

export async function updateProvider(id: string, input: ProviderFields): Promise<ActionResult> {
  await requirePermission("gateways.manage");
  const provider = parseProvider(input, false);
  if (!id) return BAD_INPUT;
  if (typeof provider === "string") return fail(provider);
  return run(() => db.updateProvider(id, provider));
}

export async function setProviderEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  await requirePermission("gateways.manage");
  if (!id || typeof enabled !== "boolean") return BAD_INPUT;
  return run(() => db.setProviderEnabled(id, enabled));
}

export async function removeProvider(id: string): Promise<ActionResult> {
  await requirePermission("gateways.manage");
  if (!id) return BAD_INPUT;
  return run(() => db.deleteProvider(id));
}

function parseEndpoint(input: unknown): EndpointFields | string {
  if (!input || typeof input !== "object") return "Check the endpoint details and try again.";
  const raw = input as Partial<EndpointFields>;

  const service = PROVIDER_SERVICES.find((item) => item.id === raw.service)?.id;
  if (!service) return "Choose a service.";

  const method: HttpMethod | null = raw.method === "GET" || raw.method === "POST" ? raw.method : null;
  if (!method) return "Choose GET or POST.";

  const path = typeof raw.path === "string" ? raw.path.trim() : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 300 || /\s/.test(path)) {
    return "The path must start with / and have no spaces, like /api/data.";
  }

  const bodyTemplate = typeof raw.bodyTemplate === "string" ? raw.bodyTemplate.trim() : "";
  if (bodyTemplate.length > 2000) return "The body template is too long (2,000 characters max).";
  if (typeof raw.active !== "boolean") return "Check the endpoint details and try again.";

  return { service, method, path, bodyTemplate: method === "GET" ? "" : bodyTemplate, active: raw.active };
}

export async function saveEndpoint(providerId: string, input: EndpointFields): Promise<ActionResult> {
  await requirePermission("gateways.manage");
  const endpoint = parseEndpoint(input);
  if (!providerId) return BAD_INPUT;
  if (typeof endpoint === "string") return fail(endpoint);
  return run(() => db.saveEndpoint(providerId, endpoint));
}

export async function setEndpointActive(
  providerId: string,
  endpointId: string,
  active: boolean,
): Promise<ActionResult> {
  await requirePermission("gateways.manage");
  if (!providerId || !endpointId || typeof active !== "boolean") return BAD_INPUT;
  return run(() => db.setEndpointActive(providerId, endpointId, active));
}

export async function removeEndpoint(providerId: string, endpointId: string): Promise<ActionResult> {
  await requirePermission("gateways.manage");
  if (!providerId || !endpointId) return BAD_INPUT;
  return run(() => db.deleteEndpoint(providerId, endpointId));
}
