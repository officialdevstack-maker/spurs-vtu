import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import {
  type PurchaseService,
  type PurchaseStatus,
  type PurchaseTemplate,
  type PurchaseTemplateFields,
} from "@/lib/admin/purchase-templates";

type Row = {
  id: string;
  name: string;
  service: PurchaseService;
  status: PurchaseStatus;
  message: string;
  active: boolean;
};

const changed = (result: { rowCount: number | null }) => (result.rowCount ?? 0) > 0;

export async function listPurchaseTemplates(): Promise<PurchaseTemplate[]> {
  const { rows } = await getPool().query<Row>(
    `select id, name, service, status, message, active
     from purchase_templates
     order by service, status, active desc, created_at`,
  );
  return rows;
}

export async function countPurchaseTemplates(): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>("select count(*)::text as n from purchase_templates");
  return Number(rows[0]?.n ?? 0);
}

export async function getPurchaseMessage(service: PurchaseService, status: PurchaseStatus): Promise<string | null> {
  const { rows } = await getPool().query<{ message: string }>(
    "select message from purchase_templates where service = $1 and status = $2 and active",
    [service, status],
  );
  return rows[0]?.message ?? null;
}

export async function createPurchaseTemplate(t: PurchaseTemplateFields): Promise<string> {
  const id = randomUUID();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (t.active) {
      await client.query(
        "update purchase_templates set active = false where service = $1 and status = $2 and active",
        [t.service, t.status],
      );
    }
    await client.query(
      `insert into purchase_templates (id, name, service, status, message, active)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, t.name, t.service, t.status, t.message, t.active],
    );
    await client.query("commit");
    return id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePurchaseTemplate(id: string, t: PurchaseTemplateFields): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (t.active) {
      await client.query(
        `update purchase_templates set active = false
         where service = $1 and status = $2 and id <> $3 and active`,
        [t.service, t.status, id],
      );
    }
    const result = await client.query(
      `update purchase_templates
       set name = $2, service = $3, status = $4, message = $5, active = $6, updated_at = now()
       where id = $1`,
      [id, t.name, t.service, t.status, t.message, t.active],
    );
    if (!changed(result)) {
      await client.query("rollback");
      return false;
    }
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setPurchaseTemplateActive(id: string, active: boolean): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query<{ service: PurchaseService; status: PurchaseStatus }>(
      "select service, status from purchase_templates where id = $1 for update",
      [id],
    );
    const row = found.rows[0];
    if (!row) {
      await client.query("rollback");
      return false;
    }
    if (active) {
      await client.query(
        `update purchase_templates set active = false
         where service = $1 and status = $2 and id <> $3 and active`,
        [row.service, row.status, id],
      );
    }
    await client.query("update purchase_templates set active = $2, updated_at = now() where id = $1", [id, active]);
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePurchaseTemplate(id: string): Promise<boolean> {
  return changed(await getPool().query("delete from purchase_templates where id = $1", [id]));
}
