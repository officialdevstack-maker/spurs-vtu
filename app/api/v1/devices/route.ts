import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { getPool } from "@/lib/db";
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  const kind = body?.kind;
  const token = body?.token;
  if ((kind !== "fcm" && kind !== "web") || typeof token !== "string" || token.length > 2048) {
    return apiError("invalid_request", "kind and token are required.", 400);
  }
  await getPool().query(
    `insert into device_tokens (id, customer_id, kind, token, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (token) do update
       set customer_id = excluded.customer_id, kind = excluded.kind,
           user_agent = excluded.user_agent, last_used_at = now()`,
    [randomUUID(), auth.ctx.customerId, kind, token, request.headers.get("user-agent")?.slice(0, 200) ?? null],
  );
  return apiOk({ registered: true });
}
