import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { resolvePackagePrice, type PackageOption, type PackagePrice, type PriceMode, type ProviderOption } from "@/lib/admin/airtime-data";
import type { CableOperator, CablePlan } from "@/lib/admin/cable";
import type { CableCatalogOperator, CableCatalogPlan } from "@/lib/cable-purchase";

export type CablePlanFields = {
  name: string;
  validity: string;
  cost: number;
  price: number;
  packagePrices: PackagePrice[];
  providerId: string | null;
  providerPlanId: string;
  active: boolean;
};

type OperatorRow = { id: string; name: string; enabled: boolean };
type PlanRow = {
  id: string;
  operator_id: string;
  name: string;
  validity: string;
  cost: string;
  price: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_plan_id: string;
  active: boolean;
};
type PackagePriceRow = { plan_id: string; package_id: string; mode: PriceMode; value: string };

const dbFail = (code: "BAD_PROVIDER") => Object.assign(new Error(code), { code });
const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

const PLAN_SELECT = `select p.id, p.operator_id, p.name, p.validity, p.cost, p.price,
       p.provider_id, pr.name as provider_name, p.provider_plan_id, p.active
     from cable_plans p
     left join providers pr on pr.id = p.provider_id`;

const toPackagePrice = (r: PackagePriceRow): PackagePrice => ({
  packageId: r.package_id,
  mode: r.mode,
  value: Number(r.value),
});

const toPlan = (r: PlanRow, packagePrices: PackagePrice[] = []): CablePlan => ({
  id: r.id,
  name: r.name,
  validity: r.validity,
  cost: Number(r.cost),
  price: Number(r.price),
  packagePrices,
  providerId: r.provider_id,
  providerName: r.provider_name,
  providerPlanId: r.provider_plan_id,
  active: r.active,
});

export async function getCableOperators(): Promise<CableOperator[]> {
  const pool = getPool();
  const [operators, plans, prices] = await Promise.all([
    pool.query<OperatorRow>("select id, name, enabled from cable_operators order by sort_order, name"),
    pool.query<PlanRow>(
      `${PLAN_SELECT}
        join cable_operators o on o.id = p.operator_id
        order by p.price, p.name`,
    ),
    pool.query<PackagePriceRow>(
      "select plan_id, package_id, mode, value from cable_plan_package_prices",
    ),
  ]);

  const pricesByPlan = new Map<string, PackagePrice[]>();
  for (const row of prices.rows) {
    const list = pricesByPlan.get(row.plan_id) ?? [];
    list.push(toPackagePrice(row));
    pricesByPlan.set(row.plan_id, list);
  }

  const plansByOperator = new Map<string, CablePlan[]>();
  for (const row of plans.rows) {
    const list = plansByOperator.get(row.operator_id) ?? [];
    list.push(toPlan(row, pricesByPlan.get(row.id) ?? []));
    plansByOperator.set(row.operator_id, list);
  }

  return operators.rows.map((operator) => ({
    id: operator.id,
    name: operator.name,
    enabled: operator.enabled,
    plans: plansByOperator.get(operator.id) ?? [],
  }));
}

export async function createOperator(id: string, name: string): Promise<boolean> {
  return changed(
    await getPool().query(
      "insert into cable_operators (id, name, sort_order) values ($1, $2, (select coalesce(max(sort_order), 0) + 1 from cable_operators))",
      [id, name],
    ),
  );
}

export async function renameOperator(id: string, name: string) {
  return changed(await getPool().query("update cable_operators set name = $2 where id = $1", [id, name]));
}

export async function setOperatorEnabled(id: string, enabled: boolean) {
  return changed(await getPool().query("update cable_operators set enabled = $2 where id = $1", [id, enabled]));
}

export async function deleteOperator(id: string) {
  return changed(await getPool().query("delete from cable_operators where id = $1", [id]));
}

async function checkPlan(plan: CablePlanFields) {
  if (!plan.providerId) return;
  const provider = await getPool().query(
    `select 1 from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'cable'
     where p.id = $1`,
    [plan.providerId],
  );
  if (!provider.rowCount) throw dbFail("BAD_PROVIDER");
}

async function writePackagePrices(client: PoolClient, planId: string, prices: PackagePrice[]) {
  await client.query("delete from cable_plan_package_prices where plan_id = $1", [planId]);
  if (prices.length === 0) return;
  await client.query(
    `insert into cable_plan_package_prices (plan_id, package_id, mode, value)
     select $1, t.package_id, t.mode, t.value
     from unnest($2::text[], $3::text[], $4::numeric[]) as t(package_id, mode, value)`,
    [planId, prices.map((p) => p.packageId), prices.map((p) => p.mode), prices.map((p) => p.value)],
  );
}

export async function createCablePlan(operator: string, p: CablePlanFields) {
  await checkPlan(p);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const id = randomUUID();
    const result = await client.query(
      `insert into cable_plans
         (id, operator_id, name, validity, cost, price, provider_id, provider_plan_id, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, operator, p.name, p.validity, p.cost, p.price, p.providerId, p.providerPlanId, p.active],
    );
    if (!changed(result)) {
      await client.query("rollback");
      return false;
    }
    await writePackagePrices(client, id, p.packagePrices);
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCablePlan(operator: string, planId: string, p: CablePlanFields) {
  await checkPlan(p);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `update cable_plans
       set name = $3, validity = $4, cost = $5, price = $6, provider_id = $7, provider_plan_id = $8, active = $9
       where id = $1 and operator_id = $2`,
      [planId, operator, p.name, p.validity, p.cost, p.price, p.providerId, p.providerPlanId, p.active],
    );
    if (!changed(result)) {
      await client.query("rollback");
      return false;
    }
    await writePackagePrices(client, planId, p.packagePrices);
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCablePlanActive(operator: string, planId: string, active: boolean) {
  return changed(
    await getPool().query("update cable_plans set active = $3 where id = $1 and operator_id = $2", [
      planId,
      operator,
      active,
    ]),
  );
}

export async function deleteCablePlan(operator: string, planId: string) {
  return changed(
    await getPool().query("delete from cable_plans where id = $1 and operator_id = $2", [planId, operator]),
  );
}

export async function getCablePlan(id: string): Promise<{ operatorId: string; plan: CablePlan } | null> {
  const pool = getPool();
  const [plans, prices] = await Promise.all([
    pool.query<PlanRow>(`${PLAN_SELECT} where p.id = $1`, [id]),
    pool.query<PackagePriceRow>("select plan_id, package_id, mode, value from cable_plan_package_prices where plan_id = $1", [
      id,
    ]),
  ]);
  const row = plans.rows[0];
  return row ? { operatorId: row.operator_id, plan: toPlan(row, prices.rows.map(toPackagePrice)) } : null;
}

export async function getCablePlanFormContext(operatorId: string, includeProvider?: string) {
  const pool = getPool();
  const [operator, providers, packages] = await Promise.all([
    pool.query<{ id: string; name: string }>("select id, name from cable_operators where id = $1", [operatorId]),
    pool.query<ProviderOption>(
      `select p.id, p.name from providers p
       where (p.enabled and exists (
               select 1 from provider_endpoints e
               where e.provider_id = p.id and e.service = 'cable' and e.active))
          or p.id = $1
       order by p.priority, p.name`,
      [includeProvider ?? null],
    ),
    pool.query<PackageOption>("select id, name from packages order by sort_order, name"),
  ]);
  const found = operator.rows[0];
  if (!found) return null;
  return { operator: found, providers: providers.rows, packages: packages.rows };
}

/** Enabled operators with active bouquets that have a live provider, priced for `packageId`. */
export async function getCableCatalog(packageId: string): Promise<CableCatalogOperator[]> {
  const pool = getPool();
  const [operators, plans, prices] = await Promise.all([
    pool.query<{ id: string; name: string }>(
      "select id, name from cable_operators where enabled order by sort_order, name",
    ),
    pool.query<{ id: string; operator_id: string; name: string; validity: string; price: string }>(
      `select p.id, p.operator_id, p.name, p.validity, p.price
       from cable_plans p
       where p.active
         and exists (
           select 1 from providers pr
           join provider_endpoints e on e.provider_id = pr.id and e.service = 'cable' and e.active
           where pr.enabled and (p.provider_id is null or pr.id = p.provider_id))
       order by p.price, p.name`,
    ),
    pool.query<{ plan_id: string; mode: PriceMode; value: string }>(
      "select plan_id, mode, value from cable_plan_package_prices where package_id = $1",
      [packageId],
    ),
  ]);

  const overrides = new Map(prices.rows.map((row) => [row.plan_id, row]));
  const byOperator = new Map<string, CableCatalogPlan[]>();
  for (const row of plans.rows) {
    const standardPrice = Number(row.price);
    const override = overrides.get(row.id);
    const list = byOperator.get(row.operator_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      validity: row.validity,
      price: override ? resolvePackagePrice(standardPrice, override.mode, Number(override.value)) : standardPrice,
      standardPrice,
    });
    byOperator.set(row.operator_id, list);
  }

  return operators.rows
    .map((operator) => ({ id: operator.id, name: operator.name, plans: byOperator.get(operator.id) ?? [] }))
    .filter((operator) => operator.plans.length > 0);
}

export type PurchasableCablePlan = {
  id: string;
  operatorId: string;
  operatorName: string;
  name: string;
  validity: string;
  cost: number;
  providerId: string | null;
  providerPlanId: string;
};

export async function getPurchasableCablePlan(planId: string): Promise<PurchasableCablePlan | null> {
  const { rows } = await getPool().query<{
    id: string;
    operator_id: string;
    operator_name: string;
    name: string;
    validity: string;
    cost: string;
    provider_id: string | null;
    provider_plan_id: string;
  }>(
    `select p.id, p.operator_id, o.name as operator_name, p.name, p.validity, p.cost,
            p.provider_id, p.provider_plan_id
     from cable_plans p
     join cable_operators o on o.id = p.operator_id and o.enabled
     where p.id = $1 and p.active`,
    [planId],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        operatorId: row.operator_id,
        operatorName: row.operator_name,
        name: row.name,
        validity: row.validity,
        cost: Number(row.cost),
        providerId: row.provider_id,
        providerPlanId: row.provider_plan_id,
      }
    : null;
}

export async function getCablePlanPriceForPackage(planId: string, packageId: string): Promise<number | null> {
  const { rows } = await getPool().query<{ price: string; mode: PriceMode | null; value: string | null }>(
    `select p.price, pp.mode, pp.value
     from cable_plans p
     left join cable_plan_package_prices pp on pp.plan_id = p.id and pp.package_id = $2
     where p.id = $1 and p.active`,
    [planId, packageId],
  );
  const row = rows[0];
  if (!row) return null;
  const price = Number(row.price);
  return row.mode && row.value !== null ? resolvePackagePrice(price, row.mode, Number(row.value)) : price;
}

export async function pickCableProvider(preferredId: string | null): Promise<string | null> {
  const { rows } = await getPool().query<{ id: string }>(
    `select p.id
     from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'cable' and e.active
     where p.enabled and ($1::text is null or p.id = $1)
     order by p.priority, p.name
     limit 1`,
    [preferredId],
  );
  return rows[0]?.id ?? null;
}

/** Prefers `preferredId` when it has a verify endpoint, otherwise the highest-priority provider that does. */
export async function pickCableVerifyProvider(preferredId: string | null): Promise<string | null> {
  const { rows } = await getPool().query<{ id: string }>(
    `select p.id
     from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'cable_verify' and e.active
     where p.enabled
     order by ($1::text is not null and p.id = $1) desc, p.priority, p.name
     limit 1`,
    [preferredId],
  );
  return rows[0]?.id ?? null;
}

export async function hasCableVerifyProvider(): Promise<boolean> {
  return (await pickCableVerifyProvider(null)) !== null;
}
