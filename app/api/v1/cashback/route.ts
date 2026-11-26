import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getPool } from "@/lib/db";
import { getCashbackBalanceKobo, getCashbackSettings } from "@/lib/db/cashback";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  try {
    const pool = getPool();
    const [balance, settings, history] = await Promise.all([
      getCashbackBalanceKobo(auth.ctx.customerId),
      getCashbackSettings(),
      pool.query(
        `select reference, direction, amount_kobo::text, source, service, created_at
         from cashback_ledger where customer_id = $1 order by created_at desc, reference limit 50`,
        [auth.ctx.customerId],
      ),
    ]);
    return apiOk({
      balance: Number(balance) / 100,
      settings,
      history: history.rows.map((row) => ({
        reference: row.reference,
        direction: row.direction,
        amount: Number(row.amount_kobo) / 100,
        source: row.source,
        service: row.service,
        at: row.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[api] cashback", error);
    return apiError("server_error", "Something went wrong.", 500);
  }
}
