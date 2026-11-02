import { NextResponse } from "next/server";
import { z } from "zod";
import { isBusinessInternalRequest } from "@/lib/business-internal/auth";
import { getPool } from "@/lib/db";

const WorkspaceId = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  if (!isBusinessInternalRequest(request)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { workspaceId } = await params;
  if (!WorkspaceId.safeParse(workspaceId).success) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const search = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(search.get("limit")) || 50, 1), 100);
  const { rows } = await getPool().query(
    `SELECT t.id,
            t.customer_id AS "customerId",
            c.name AS "customerName",
            c.username,
            t.service,
            t.title,
            t.detail,
            t.amount,
            t.cost,
            t.direction,
            t.status,
            t.failure_reason AS "failureReason",
            t.created_at AS "createdAt"
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
      WHERE t.workspace_id = $1
      ORDER BY t.created_at DESC, t.id
      LIMIT $2`,
    [workspaceId, limit],
  );
  return NextResponse.json({ transactions: rows });
}
