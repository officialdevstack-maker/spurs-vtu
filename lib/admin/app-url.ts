import "server-only";

export async function getAppBaseUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (!configured) throw new Error("APP_URL must be set to generate payment webhook URLs.");
  const url = new URL(configured);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("APP_URL must use HTTPS except for localhost.");
  }
  return url.origin;
}
