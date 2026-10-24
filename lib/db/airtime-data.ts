import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import type {
  AirtimeDataProducts,
  AirtimeDiscount,
  DataPlan,
  DataTypeOption,
  DataUnit,
  NetworkProduct,
  PackageOption,
  PackagePrice,
  PinStock,
  PriceMode,
  ProviderOption,
  Service,
} from "@/lib/admin/airtime-data";
import { formatVolume, resolvePackagePrice } from "@/lib/admin/airtime-data";

export type PlanFields = {
  type: string;
  volume: number;
  unit: DataUnit;
  validity: string;
  cost: number;
  price: number;
  packagePrices: PackagePrice[];
  providerId: string | null;
  providerPlanId: string;
  active: boolean;
};

export type DiscountFields = {
  type: string;
  min: number;
  max: number;
  discount: number;
  providerId: string | null;
  providerDiscount: number | null;
  active: boolean;
};

type NetworkRow = { id: string; name: string; enabled: boolean };
type TypeRow = { id: string; label: string; service: Service };
type PlanRow = {
  id: string;
  network_id: string;
  type_id: string;
  size: string;
  volume: string | null;
  unit: DataUnit | null;
  validity: string;
  cost: string;
  price: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_plan_id: string;
  active: boolean;
};
type PackagePriceRow = { plan_id: string; package_id: string; mode: PriceMode; value: string };

type DiscountRow = {
  id: string;
  network_id: string;
  type_id: string;
  discount: string;
  min_amount: string;
  max_amount: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_discount: string | null;
  active: boolean;
};
type PinRow = {
  id: string;
  network_id: string;
  kind: "airtime" | "data";
  label: string;
  price: string;
  available: number;
  used: number;
};

const dbFail = (code: "OVERLAP" | "BAD_AIRTIME_TYPE" | "BAD_DATA_TYPE" | "BAD_PROVIDER") =>
  Object.assign(new Error(code), { code });

const PLAN_SELECT = `select p.id, p.network_id, p.type_id, p.size, p.volume, p.unit, p.validity, p.cost, p.price,
       p.provider_id, pr.name as provider_name, p.provider_plan_id, p.active
     from data_plans p
     left join providers pr on pr.id = p.provider_id`;

function group<T extends { network_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.network_id);
    if (list) list.push(row);
    else map.set(row.network_id, [row]);
  }
  return map;
}

const toPackagePrice = (r: PackagePriceRow): PackagePrice => ({
  packageId: r.package_id,
  mode: r.mode,
  value: Number(r.value),
});

const toPlan = (r: PlanRow, packagePrices: PackagePrice[] = []): DataPlan => ({
  id: r.id,
  type: r.type_id,
  size: r.size,
  volume: r.volume === null ? 0 : Number(r.volume),
  unit: r.unit ?? "mb",
  validity: r.validity,
  cost: Number(r.cost),
  price: Number(r.price),
  packagePrices,
  providerId: r.provider_id,
  providerName: r.provider_name,
  providerPlanId: r.provider_plan_id,
  active: r.active,
});

const toDiscount = (r: DiscountRow): AirtimeDiscount => ({
  id: r.id,
  type: r.type_id,
  min: Number(r.min_amount),
  max: Number(r.max_amount),
  discount: Number(r.discount),
  providerId: r.provider_id,
  providerName: r.provider_name,
  providerDiscount: r.provider_discount === null ? null : Number(r.provider_discount),
  active: r.active,
});

const toPin = (r: PinRow): PinStock => ({
  id: r.id,
  label: r.label,
  price: Number(r.price),
  available: r.available,
  used: r.used,
});

const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

export async function getAirtimeDataProducts(): Promise<AirtimeDataProducts> {
  const pool = getPool();
  const [networks, types, enabled, plans, discounts, pins, packagePrices] = await Promise.all([
    pool.query<NetworkRow>("select id, name, enabled from networks order by sort_order, name"),
    pool.query<TypeRow>("select id, label, service from data_types order by service, created_at, label"),
    pool.query<{ network_id: string; type_id: string }>("select network_id, type_id from network_data_types where enabled"),
    pool.query<PlanRow>(`${PLAN_SELECT} order by p.cost, p.size`),
    pool.query<DiscountRow>(
      `select d.id, d.network_id, d.type_id, d.discount, d.min_amount, d.max_amount,
              d.provider_id, p.name as provider_name, d.provider_discount, d.active
       from airtime_discounts d
       left join providers p on p.id = d.provider_id
       order by d.type_id, d.min_amount`,
    ),
    pool.query<PinRow>("select id, network_id, kind, label, price, available, used from pin_stock order by price"),
    pool.query<PackagePriceRow>("select plan_id, package_id, mode, value from data_plan_package_prices"),
  ]);

  const enabledByNetwork = group(enabled.rows);
  const plansByNetwork = group(plans.rows);
  const discountsByNetwork = group(discounts.rows);
  const pinsByNetwork = group(pins.rows);
  const pricesByPlan = new Map<string, PackagePrice[]>();
  for (const row of packagePrices.rows) {
    const list = pricesByPlan.get(row.plan_id) ?? [];
    list.push(toPackagePrice(row));
    pricesByPlan.set(row.plan_id, list);
  }

  const products: NetworkProduct[] = networks.rows.map((n) => {
    const networkPins = pinsByNetwork.get(n.id) ?? [];
    return {
      id: n.id,
      name: n.name,
      enabled: n.enabled,
      enabledTypes: (enabledByNetwork.get(n.id) ?? []).map((r) => r.type_id),
      plans: (plansByNetwork.get(n.id) ?? []).map((plan) => toPlan(plan, pricesByPlan.get(plan.id) ?? [])),
      discounts: (discountsByNetwork.get(n.id) ?? []).map(toDiscount),
      airtimePins: networkPins.filter((p) => p.kind === "airtime").map(toPin),
      dataPins: networkPins.filter((p) => p.kind === "data").map(toPin),
    };
  });

  return { networks: products, types: types.rows };
}

export async function createNetwork(id: string, name: string): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      "insert into networks (id, name, sort_order) values ($1, $2, (select coalesce(max(sort_order), 0) + 1 from networks))",
      [id, name],
    );
    await client.query("insert into network_data_types (network_id, type_id) select $1, id from data_types", [id]);
    await client.query("commit");
    return true;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function renameNetwork(id: string, name: string) {
  return changed(await getPool().query("update networks set name = $2 where id = $1", [id, name]));
}

export async function setNetworkEnabled(id: string, enabled: boolean) {
  return changed(await getPool().query("update networks set enabled = $2 where id = $1", [id, enabled]));
}

export async function deleteNetwork(id: string) {
  return changed(await getPool().query("delete from networks where id = $1", [id]));
}

export async function createDataType(id: string, label: string, service: Service): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("insert into data_types (id, label, service) values ($1, $2, $3)", [id, label, service]);
    await client.query("insert into network_data_types (network_id, type_id) select id, $1 from networks", [id]);
    await client.query("commit");
    return true;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function renameDataType(id: string, label: string) {
  return changed(await getPool().query("update data_types set label = $2 where id = $1", [id, label]));
}

export async function deleteDataType(id: string) {
  return changed(await getPool().query("delete from data_types where id = $1", [id]));
}

export async function setNetworkTypeEnabled(network: string, type: string, enabled: boolean) {
  return changed(
    await getPool().query(
      `insert into network_data_types (network_id, type_id, enabled) values ($1, $2, $3)
       on conflict (network_id, type_id) do update set enabled = excluded.enabled`,
      [network, type, enabled],
    ),
  );
}

async function checkPlan(plan: PlanFields) {
  const pool = getPool();
  const type = await pool.query("select 1 from data_types where id = $1 and service = 'data'", [plan.type]);
  if (!type.rowCount) throw dbFail("BAD_DATA_TYPE");

  if (plan.providerId) {
    const provider = await pool.query(
      `select 1 from providers p
       join provider_endpoints e on e.provider_id = p.id and e.service = 'data'
       where p.id = $1`,
      [plan.providerId],
    );
    if (!provider.rowCount) throw dbFail("BAD_PROVIDER");
  }
}

async function writePackagePrices(client: PoolClient, planId: string, prices: PackagePrice[]) {
  await client.query("delete from data_plan_package_prices where plan_id = $1", [planId]);
  if (prices.length === 0) return;
  await client.query(
    `insert into data_plan_package_prices (plan_id, package_id, mode, value)
     select $1, t.package_id, t.mode, t.value
     from unnest($2::text[], $3::text[], $4::numeric[]) as t(package_id, mode, value)`,
    [planId, prices.map((p) => p.packageId), prices.map((p) => p.mode), prices.map((p) => p.value)],
  );
}

export async function createPlan(network: string, p: PlanFields) {
  await checkPlan(p);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const id = randomUUID();
    const result = await client.query(
      `insert into data_plans
         (id, network_id, type_id, size, volume, unit, validity, cost, price, provider_id, provider_plan_id, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        network,
        p.type,
        formatVolume(p.volume, p.unit),
        p.volume,
        p.unit,
        p.validity,
        p.cost,
        p.price,
        p.providerId,
        p.providerPlanId,
        p.active,
      ],
    );
    await writePackagePrices(client, id, p.packagePrices);
    await client.query("commit");
    return changed(result);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePlan(network: string, planId: string, p: PlanFields) {
  await checkPlan(p);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `update data_plans
       set type_id = $3, size = $4, volume = $5, unit = $6, validity = $7, cost = $8, price = $9,
           provider_id = $10, provider_plan_id = $11, active = $12
       where id = $1 and network_id = $2`,
      [
        planId,
        network,
        p.type,
        formatVolume(p.volume, p.unit),
        p.volume,
        p.unit,
        p.validity,
        p.cost,
        p.price,
        p.providerId,
        p.providerPlanId,
        p.active,
      ],
    );
    await writePackagePrices(client, planId, p.packagePrices);
    await client.query("commit");
    return changed(result);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function getPlan(id: string): Promise<{ networkId: string; plan: DataPlan } | null> {
  const pool = getPool();
  const [plans, prices] = await Promise.all([
    pool.query<PlanRow>(`${PLAN_SELECT} where p.id = $1`, [id]),
    pool.query<PackagePriceRow>("select plan_id, package_id, mode, value from data_plan_package_prices where plan_id = $1", [id]),
  ]);
  const row = plans.rows[0];
  return row ? { networkId: row.network_id, plan: toPlan(row, prices.rows.map(toPackagePrice)) } : null;
}

export async function getPlanFormContext(networkId: string, includeType?: string, includeProvider?: string) {
  const pool = getPool();
  const [network, types, providers, packages] = await Promise.all([
    pool.query<{ id: string; name: string }>("select id, name from networks where id = $1", [networkId]),
    pool.query<TypeRow>(
      `select t.id, t.label, t.service
       from data_types t
       left join network_data_types nt on nt.type_id = t.id and nt.network_id = $1
       where t.service = 'data' and (coalesce(nt.enabled, false) or t.id = $2)
       order by t.created_at, t.label`,
      [networkId, includeType ?? null],
    ),
    pool.query<ProviderOption>(
      `select p.id, p.name from providers p
       where (p.enabled and exists (
               select 1 from provider_endpoints e
               where e.provider_id = p.id and e.service = 'data' and e.active))
          or p.id = $1
       order by p.priority, p.name`,
      [includeProvider ?? null],
    ),
    pool.query<PackageOption>("select id, name from packages order by sort_order, name"),
  ]);
  const found = network.rows[0];
  if (!found) return null;
  const options: DataTypeOption[] = types.rows;
  return { network: found, types: options, providers: providers.rows, packages: packages.rows };
}

/** What a customer on `packageId` pays for an active plan. null if the plan doesn't exist or is off. */
export async function getPlanPriceForPackage(planId: string, packageId: string): Promise<number | null> {
  const { rows } = await getPool().query<{ price: string; mode: PriceMode | null; value: string | null }>(
    `select p.price, pp.mode, pp.value
     from data_plans p
     left join data_plan_package_prices pp on pp.plan_id = p.id and pp.package_id = $2
     where p.id = $1 and p.active`,
    [planId, packageId],
  );
  const row = rows[0];
  if (!row) return null;
  const price = Number(row.price);
  return row.mode && row.value !== null ? resolvePackagePrice(price, row.mode, Number(row.value)) : price;
}

export async function getCustomerPackageId(customerId: string): Promise<string> {
  const { rows } = await getPool().query<{ package_id: string }>(
    "select package_id from customers where id = $1",
    [customerId],
  );
  return rows[0]?.package_id ?? "basic";
}

export async function setPlanActive(network: string, planId: string, active: boolean) {
  return changed(
    await getPool().query("update data_plans set active = $3 where id = $1 and network_id = $2", [
      planId,
      network,
      active,
    ]),
  );
}

export async function deletePlan(network: string, planId: string) {
  return changed(await getPool().query("delete from data_plans where id = $1 and network_id = $2", [planId, network]));
}

async function checkDiscount(network: string, d: DiscountFields, ignoreId: string | null) {
  const pool = getPool();
  const type = await pool.query("select 1 from data_types where id = $1 and service = 'airtime'", [d.type]);
  if (!type.rowCount) throw dbFail("BAD_AIRTIME_TYPE");

  if (d.providerId) {
    const provider = await pool.query(
      `select 1 from providers p
       join provider_endpoints e on e.provider_id = p.id and e.service = 'airtime'
       where p.id = $1`,
      [d.providerId],
    );
    if (!provider.rowCount) throw dbFail("BAD_PROVIDER");
  }

  const overlap = await pool.query(
    `select 1 from airtime_discounts
     where network_id = $1 and type_id = $2
       and ($5::text is null or id <> $5)
       and min_amount <= $4 and max_amount >= $3
     limit 1`,
    [network, d.type, d.min, d.max, ignoreId],
  );
  if (overlap.rowCount) throw dbFail("OVERLAP");
}

export async function createDiscount(network: string, d: DiscountFields) {
  await checkDiscount(network, d, null);
  return changed(
    await getPool().query(
      `insert into airtime_discounts
         (id, network_id, type_id, discount, min_amount, max_amount, provider_id, provider_discount, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [randomUUID(), network, d.type, d.discount, d.min, d.max, d.providerId, d.providerDiscount, d.active],
    ),
  );
}

export async function updateDiscount(network: string, id: string, d: DiscountFields) {
  await checkDiscount(network, d, id);
  return changed(
    await getPool().query(
      `update airtime_discounts
       set type_id = $3, discount = $4, min_amount = $5, max_amount = $6,
           provider_id = $7, provider_discount = $8, active = $9
       where id = $1 and network_id = $2`,
      [id, network, d.type, d.discount, d.min, d.max, d.providerId, d.providerDiscount, d.active],
    ),
  );
}

export async function setDiscountActive(network: string, id: string, active: boolean) {
  return changed(
    await getPool().query("update airtime_discounts set active = $3 where id = $1 and network_id = $2", [
      id,
      network,
      active,
    ]),
  );
}

export async function deleteDiscount(network: string, id: string) {
  return changed(await getPool().query("delete from airtime_discounts where id = $1 and network_id = $2", [id, network]));
}

export async function getDiscount(id: string): Promise<{ networkId: string; discount: AirtimeDiscount } | null> {
  const { rows } = await getPool().query<DiscountRow>(
    `select d.id, d.network_id, d.type_id, d.discount, d.min_amount, d.max_amount,
            d.provider_id, p.name as provider_name, d.provider_discount, d.active
     from airtime_discounts d
     left join providers p on p.id = d.provider_id
     where d.id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? { networkId: row.network_id, discount: toDiscount(row) } : null;
}

export async function getDiscountFormContext(
  networkId: string,
  includeType?: string,
  includeProvider?: string,
) {
  const pool = getPool();
  const [network, types, providers] = await Promise.all([
    pool.query<{ id: string; name: string }>("select id, name from networks where id = $1", [networkId]),
    pool.query<TypeRow>(
      `select t.id, t.label, t.service
       from data_types t
       left join network_data_types nt on nt.type_id = t.id and nt.network_id = $1
       where t.service = 'airtime' and (coalesce(nt.enabled, false) or t.id = $2)
       order by t.created_at, t.label`,
      [networkId, includeType ?? null],
    ),
    pool.query<ProviderOption>(
      `select p.id, p.name from providers p
       where (p.enabled and exists (
               select 1 from provider_endpoints e
               where e.provider_id = p.id and e.service = 'airtime' and e.active))
          or p.id = $1
       order by p.priority, p.name`,
      [includeProvider ?? null],
    ),
  ]);
  const found = network.rows[0];
  if (!found) return null;
  const options: DataTypeOption[] = types.rows;
  return { network: found, types: options, providers: providers.rows };
}

export async function findAirtimeDiscount(network: string, type: string, amount: number) {
  const { rows } = await getPool().query<DiscountRow>(
    `select d.id, d.network_id, d.type_id, d.discount, d.min_amount, d.max_amount,
            d.provider_id, p.name as provider_name, d.provider_discount, d.active
     from airtime_discounts d
     left join providers p on p.id = d.provider_id
     where d.network_id = $1 and d.type_id = $2 and d.active
       and d.min_amount <= $3 and d.max_amount >= $3
     limit 1`,
    [network, type, amount],
  );
  return rows[0] ? toDiscount(rows[0]) : null;
}
