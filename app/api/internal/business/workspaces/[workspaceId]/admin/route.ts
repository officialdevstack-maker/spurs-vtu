import { NextResponse } from "next/server";
import { z } from "zod";
import { isBusinessInternalRequest } from "@/lib/business-internal/auth";
import { getAirtimeDataProducts } from "@/lib/db/airtime-data";
import { getCableOperators } from "@/lib/db/cable";
import { getPool } from "@/lib/db";
import { listPackages } from "@/lib/db/packages";
import { getProviders } from "@/lib/db/providers";

const WorkspaceId = z.string().uuid();
const Resource = z.enum(["overview", "products", "providers", "packages"]);

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
  const parsedResource = Resource.safeParse(new URL(request.url).searchParams.get("resource"));
  if (!parsedResource.success) {
    return NextResponse.json({ error: "INVALID_RESOURCE" }, { status: 400 });
  }

  try {
    switch (parsedResource.data) {
      case "overview": {
        const [customers, transactions] = await Promise.all([
          getPool().query<{ count: string }>(
            "SELECT count(*)::text AS count FROM workspace_customers WHERE workspace_id = $1",
            [workspaceId],
          ),
          getPool().query<{
            total: string;
            pending: string;
            failed: string;
            revenue: string;
          }>(
            `SELECT count(*)::text AS total,
                    count(*) FILTER (WHERE status = 'pending')::text AS pending,
                    count(*) FILTER (WHERE status = 'failed')::text AS failed,
                    coalesce(sum(amount) FILTER (WHERE status = 'success'), 0)::text AS revenue
               FROM transactions
              WHERE workspace_id = $1 AND direction = 'debit'`,
            [workspaceId],
          ),
        ]);
        return NextResponse.json({
          customers: Number(customers.rows[0]?.count ?? 0),
          transactions: {
            total: Number(transactions.rows[0]?.total ?? 0),
            pending: Number(transactions.rows[0]?.pending ?? 0),
            failed: Number(transactions.rows[0]?.failed ?? 0),
            revenue: Number(transactions.rows[0]?.revenue ?? 0),
          },
        });
      }
      case "products": {
        const [airtimeData, cable] = await Promise.all([
          getAirtimeDataProducts(workspaceId),
          getCableOperators(workspaceId),
        ]);
        return NextResponse.json({ airtimeData, cable });
      }
      case "providers":
        return NextResponse.json({ providers: await getProviders(workspaceId) });
      case "packages":
        return NextResponse.json({ packages: await listPackages(workspaceId) });
    }
  } catch (error) {
    console.error("[business-admin] Could not load workspace admin resource", parsedResource.data, error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
