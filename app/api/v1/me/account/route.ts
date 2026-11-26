import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getPool } from "@/lib/db";

export async function DELETE(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  try {
    const result = await getPool().query(
      `update customers set deletion_requested_at = coalesce(deletion_requested_at, now()), status = 'suspended'
       where id = $1 and deleted_at is null
       returning id`,
      [auth.ctx.customerId],
    );
    return (result.rowCount ?? 0) === 1
      ? apiOk({ deletionRequested: true })
      : apiError("conflict", "Account deletion is already complete or pending.", 409);
  } catch (error) {
    console.error("[api] account deletion", error);
    return apiError("server_error", "Could not request account deletion.", 500);
  }
}
