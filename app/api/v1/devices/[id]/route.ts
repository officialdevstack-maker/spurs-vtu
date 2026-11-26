import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { getPool } from "@/lib/db";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await getPool().query(
    "delete from device_tokens where id = $1 and customer_id = $2",
    [id, auth.ctx.customerId],
  );
  return (result.rowCount ?? 0) === 1
    ? apiOk({ removed: true })
    : apiError("not_found", "Device not found.", 404);
}
