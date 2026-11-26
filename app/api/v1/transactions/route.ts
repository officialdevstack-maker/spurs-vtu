import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { listCustomerTransactions } from "@/lib/db/transactions";
import { HISTORY_PAGE_SIZE, parseHistoryParams } from "@/lib/transactions-history";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "transactions");
  if (!auth.ok) return auth.response;
  const query = parseHistoryParams(Object.fromEntries(new URL(request.url).searchParams));
  try {
    const { items, total, page } = await listCustomerTransactions(auth.ctx.customerId, { ...query, pageSize: HISTORY_PAGE_SIZE });
    return apiOk({
      page, pageSize: HISTORY_PAGE_SIZE, total,
      items: items.map((item) => ({
        reference: item.id, service: item.service, title: item.title, amount: item.amount,
        detail: item.detail, direction: item.direction, status: item.status, at: item.at,
        failureReason: item.failureReason, refunded: item.refunded, cashbackUsed: item.cashbackUsed,
      })),
    });
  } catch (error) {
    console.error("[api] transactions list", error);
    return apiError("server_error", "Something went wrong. Try again.", 500);
  }
}
