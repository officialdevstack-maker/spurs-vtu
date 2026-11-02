import { NextResponse } from "next/server";
import { z } from "zod";
import { isBusinessInternalRequest } from "@/lib/business-internal/auth";
import { getPool } from "@/lib/db";

const WorkspaceId = z.string().uuid();
const CustomerInput = z.object({
  userId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(120).nullable().optional(),
  username: z.string().trim().min(1).max(64).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
});

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
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const search = query ? `%${query.replace(/[!%_]/g, "!$&")}%` : null;

  const { rows } = await getPool().query(
    `SELECT c.id AS "userId",
            c.name,
            c.username,
            c.email,
            wc.status,
            wc.created_at AS "createdAt",
            wc.last_seen_at AS "lastSeenAt"
       FROM workspace_customers wc
       JOIN customers c ON c.id = wc.customer_id
      WHERE wc.workspace_id = $1
        AND ($2::text IS NULL OR c.name ILIKE $2 ESCAPE '!'
             OR c.username ILIKE $2 ESCAPE '!' OR c.email ILIKE $2 ESCAPE '!')
      ORDER BY wc.last_seen_at DESC, c.id
      LIMIT 100`,
    [workspaceId, search],
  );
  return NextResponse.json({ customers: rows });
}

export async function POST(
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
  const parsed = CustomerInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const customer = parsed.data;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `INSERT INTO customers (id, name, username, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, customers.name),
             username = COALESCE(EXCLUDED.username, customers.username),
             email = COALESCE(EXCLUDED.email, customers.email),
             last_seen_at = now()
       RETURNING id`,
      [customer.userId, customer.name ?? null, customer.username ?? null, customer.email?.toLowerCase() ?? null],
    );
    if (!existing.rows[0]) throw new Error("Customer upsert returned no row.");

    const { rows } = await client.query(
      `INSERT INTO workspace_customers (workspace_id, customer_id, package_id)
       SELECT $1, $2, p.id
         FROM packages p
        WHERE p.workspace_id = $1 AND p.is_default
       UNION ALL
       SELECT $1, $2, NULL
        WHERE NOT EXISTS (SELECT 1 FROM packages p WHERE p.workspace_id = $1 AND p.is_default)
       ON CONFLICT (workspace_id, customer_id) DO UPDATE
         SET last_seen_at = now()
       RETURNING customer_id AS "userId", status, created_at AS "createdAt", last_seen_at AS "lastSeenAt"`,
      [workspaceId, customer.userId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ customer: { ...rows[0], ...customer } }, { status: 200 });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Could not roll back workspace customer link.", rollbackError);
    }
    console.error("Could not link VTU workspace customer.", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    client.release();
  }
}
