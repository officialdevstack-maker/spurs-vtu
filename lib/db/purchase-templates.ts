import "server-only";
import { getPool } from "@/lib/db";
import {
  DEFAULT_MESSAGES,
  PURCHASE_SERVICES,
  PURCHASE_STATUSES,
  type PurchaseService,
  type PurchaseStatus,
  type PurchaseTemplate,
} from "@/lib/admin/purchase-templates";

type Row = { service: PurchaseService; status: PurchaseStatus; message: string };

export async function listPurchaseTemplates(): Promise<PurchaseTemplate[]> {
  const { rows } = await getPool().query<Row>("select service, status, message from purchase_templates");
  const saved = new Map(rows.map((row) => [`${row.service}:${row.status}`, row.message]));
  return PURCHASE_SERVICES.flatMap((service) =>
    PURCHASE_STATUSES.map((status) => ({
      service: service.id,
      status: status.id,
      message: saved.get(`${service.id}:${status.id}`) ?? DEFAULT_MESSAGES[service.id][status.id],
    })),
  );
}

export async function getPurchaseMessage(service: PurchaseService, status: PurchaseStatus): Promise<string | null> {
  const { rows } = await getPool().query<{ message: string }>(
    "select message from purchase_templates where service = $1 and status = $2",
    [service, status],
  );
  return rows[0]?.message ?? null;
}

export async function savePurchaseTemplates(
  overrides: PurchaseTemplate[],
  resets: { service: PurchaseService; status: PurchaseStatus }[],
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    for (const item of overrides) {
      await client.query(
        `insert into purchase_templates (service, status, message) values ($1, $2, $3)
         on conflict (service, status) do update set message = excluded.message, updated_at = now()`,
        [item.service, item.status, item.message],
      );
    }
    for (const item of resets) {
      await client.query("delete from purchase_templates where service = $1 and status = $2", [item.service, item.status]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
