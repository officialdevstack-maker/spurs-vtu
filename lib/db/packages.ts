import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import type { Package } from "@/lib/admin/packages";

export type PackageFields = {
  name: string;
  description: string;
  sortOrder: number;
  upgradeFee: number;
  isDefault: boolean;
};

type PackageRow = {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  upgrade_fee: string;
  is_default: boolean;
  customers: string;
};

const PACKAGE_SELECT = `select p.id, p.name, p.description, p.sort_order, p.upgrade_fee, p.is_default,
       (select count(*) from customers c where c.package_id = p.id) as customers
     from packages p`;

const toPackage = (r: PackageRow): Package => ({
  id: r.id,
  name: r.name,
  description: r.description,
  sortOrder: r.sort_order,
  upgradeFee: Number(r.upgrade_fee),
  isDefault: r.is_default,
  customers: Number(r.customers),
});

const changed = (result: { rowCount: number | null }) => (result.rowCount ?? 0) > 0;

export async function listPackages(): Promise<Package[]> {
  const { rows } = await getPool().query<PackageRow>(`${PACKAGE_SELECT} order by p.sort_order, p.name`);
  return rows.map(toPackage);
}

export async function getPackage(id: string): Promise<Package | null> {
  const { rows } = await getPool().query<PackageRow>(`${PACKAGE_SELECT} where p.id = $1`, [id]);
  return rows[0] ? toPackage(rows[0]) : null;
}

export async function getCustomerPackage(customerId: string): Promise<Package | null> {
  const { rows } = await getPool().query<PackageRow>(
    `${PACKAGE_SELECT} where p.id = (select package_id from customers where id = $1)`,
    [customerId],
  );
  return rows[0] ? toPackage(rows[0]) : null;
}

export async function createPackage(id: string, p: PackageFields): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (p.isDefault) await client.query("update packages set is_default = false where is_default");
    const result = await client.query(
      `insert into packages (id, name, description, sort_order, upgrade_fee, is_default)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, p.name, p.description, p.sortOrder, p.upgradeFee, p.isDefault],
    );
    await client.query("commit");
    return changed(result);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePackage(id: string, p: PackageFields): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (p.isDefault) {
      await client.query("update packages set is_default = false where is_default and id <> $1", [id]);
    }
    const result = await client.query(
      `update packages
       set name = $2, description = $3, sort_order = $4, upgrade_fee = $5, is_default = is_default or $6
       where id = $1`,
      [id, p.name, p.description, p.sortOrder, p.upgradeFee, p.isDefault],
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

export async function deletePackage(id: string): Promise<boolean> {
  return changed(await getPool().query("delete from packages where id = $1 and not is_default", [id]));
}

export async function changeCustomerPackage(
  customerId: string,
  fromId: string,
  toId: string,
  fee: number,
  reference: string = randomUUID(),
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query(
      "update customers set package_id = $3 where id = $1 and package_id = $2",
      [customerId, fromId, toId],
    );
    if (!changed(result)) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `insert into package_changes (id, customer_id, from_package_id, to_package_id, fee)
       values ($1, $2, $3, $4, $5)`,
      [reference, customerId, fromId, toId, fee],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
