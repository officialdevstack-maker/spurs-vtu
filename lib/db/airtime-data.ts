import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import type {
  AirtimeDataProducts,
  AirtimeDiscount,
  DataPlan,
  DataTypeOption,
  NetworkProduct,
  PinStock,
  Service,
} from "@/lib/admin/airtime-data";

export type PlanFields = {
  type: string;
  size: string;
  validity: string;
  cost: number;
  price: number;
  active: boolean;
};

export type DiscountFields = {
  type: string;
  min: number;
  max: number;
  discount: number;
  active: boolean;
};

type NetworkRow = { id: string; name: string; enabled: boolean };
type TypeRow = { id: string; label: string; service: Service };
type PlanRow = {
  id: string;
  network_id: string;
  type_id: string;
  size: string;
  validity: string;
  cost: string;
  price: string;
  active: boolean;
};
type DiscountRow = {
  id: string;
  network_id: string;
  type_id: string;
  discount: string;
  min_amount: string;
  max_amount: string;
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

const dbFail = (code: "OVERLAP" | "BAD_TYPE") => Object.assign(new Error(code), { code });

function group<T extends { network_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.network_id);
    if (list) list.push(row);
    else map.set(row.network_id, [row]);
  }
  return map;
}

const toPlan = (r: PlanRow): DataPlan => ({
  id: r.id,
  type: r.type_id,
  size: r.size,
  validity: r.validity,
  cost: Number(r.cost),
  price: Number(r.price),
  active: r.active,
});

const toDiscount = (r: DiscountRow): AirtimeDiscount => ({
  id: r.id,
  type: r.type_id,
  min: Number(r.min_amount),
  max: Number(r.max_amount),
  discount: Number(r.discount),
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
  const [networks, types, enabled, plans, discounts, pins] = await Promise.all([
    pool.query<NetworkRow>("select id, name, enabled from networks order by sort_order, name"),
    pool.query<TypeRow>("select id, label, service from data_types order by service, created_at, label"),
    pool.query<{ network_id: string; type_id: string }>("select network_id, type_id from network_data_types where enabled"),
    pool.query<PlanRow>("select id, network_id, type_id, size, validity, cost, price, active from data_plans order by cost, size"),
    pool.query<DiscountRow>(
      "select id, network_id, type_id, discount, min_amount, max_amount, active from airtime_discounts order by type_id, min_amount",
    ),
    pool.query<PinRow>("select id, network_id, kind, label, price, available, used from pin_stock order by price"),
  ]);

  const enabledByNetwork = group(enabled.rows);
  const plansByNetwork = group(plans.rows);
  const discountsByNetwork = group(discounts.rows);
  const pinsByNetwork = group(pins.rows);

  const products: NetworkProduct[] = networks.rows.map((n) => {
    const networkPins = pinsByNetwork.get(n.id) ?? [];
    return {
      id: n.id,
      name: n.name,
      enabled: n.enabled,
      enabledTypes: (enabledByNetwork.get(n.id) ?? []).map((r) => r.type_id),
      plans: (plansByNetwork.get(n.id) ?? []).map(toPlan),
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

export async function createPlan(network: string, p: PlanFields) {
  return changed(
    await getPool().query(
      `insert into data_plans (id, network_id, type_id, size, validity, cost, price, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [randomUUID(), network, p.type, p.size, p.validity, p.cost, p.price, p.active],
    ),
  );
}

export async function updatePlan(network: string, planId: string, p: PlanFields) {
  return changed(
    await getPool().query(
      `update data_plans set type_id = $3, size = $4, validity = $5, cost = $6, price = $7, active = $8
       where id = $1 and network_id = $2`,
      [planId, network, p.type, p.size, p.validity, p.cost, p.price, p.active],
    ),
  );
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
  if (!type.rowCount) throw dbFail("BAD_TYPE");

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
      `insert into airtime_discounts (id, network_id, type_id, discount, min_amount, max_amount, active)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), network, d.type, d.discount, d.min, d.max, d.active],
    ),
  );
}

export async function updateDiscount(network: string, id: string, d: DiscountFields) {
  await checkDiscount(network, d, id);
  return changed(
    await getPool().query(
      `update airtime_discounts set type_id = $3, discount = $4, min_amount = $5, max_amount = $6, active = $7
       where id = $1 and network_id = $2`,
      [id, network, d.type, d.discount, d.min, d.max, d.active],
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
    "select id, network_id, type_id, discount, min_amount, max_amount, active from airtime_discounts where id = $1",
    [id],
  );
  const row = rows[0];
  return row ? { networkId: row.network_id, discount: toDiscount(row) } : null;
}

export async function getDiscountFormContext(networkId: string, includeType?: string) {
  const pool = getPool();
  const [network, types] = await Promise.all([
    pool.query<{ id: string; name: string }>("select id, name from networks where id = $1", [networkId]),
    pool.query<TypeRow>(
      `select t.id, t.label, t.service
       from data_types t
       left join network_data_types nt on nt.type_id = t.id and nt.network_id = $1
       where t.service = 'airtime' and (coalesce(nt.enabled, false) or t.id = $2)
       order by t.created_at, t.label`,
      [networkId, includeType ?? null],
    ),
  ]);
  const found = network.rows[0];
  if (!found) return null;
  const options: DataTypeOption[] = types.rows;
  return { network: found, types: options };
}
