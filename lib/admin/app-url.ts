import "server-only";
import { headers } from "next/headers";

export async function getAppBaseUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      throw new Error("APP_URL must use HTTPS except for localhost.");
    }
    return url.origin;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    requestHeaders.get("host");
  if (!host) throw new Error("APP_URL is not set and the request host is unavailable.");
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto ?? (local ? "http" : "https");
  if (proto !== "https" && !(local && proto === "http")) {
    throw new Error("The webhook URL base must use HTTPS.");
  }
  return new URL(`${proto}://${host}`).origin;
}
