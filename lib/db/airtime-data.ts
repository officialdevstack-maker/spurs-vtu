import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import type {
  AirtimeDataProducts,
  DataPlan,
  DataTypeOption,
  NetworkProduct,
  PinStock,
} from "@/lib/admin/airtime-data";

export type PlanFields = {
  type: string;
  size: string;
  validity: string;
  cost: number;
  price: number;
  active: boolean;
};

type NetworkRow = { id: string; name: string; enabled: boolean; airtime_discount: string };
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
type PinRow = {
  id: string;
  network_id: string;
  kind: "airtime" | "data";
  label: string;
  price: string;
  available: number;
  used: number;
};

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
  const [networks, types, enabled, plans, pins] = await Promise.all([
    pool.query<NetworkRow>("select id, name, enabled, airtime_discount from networks order by sort_order, name"),
    pool.query<DataTypeOption>("select id, label from data_types order by created_at, label"),
    pool.query<{ network_id: string; type_id: string }>("select network_id, type_id from network_data_types where enabled"),
    pool.query<PlanRow>("select id, network_id, type_id, size, validity, cost, price, active from data_plans order by cost, size"),
    pool.query<PinRow>("select id, network_id, kind, label, price, available, used from pin_stock order by price"),
  ]);

  const enabledByNetwork = group(enabled.rows);
  const plansByNetwork = group(plans.rows);
  const pinsByNetwork = group(pins.rows);

  const products: NetworkProduct[] = networks.rows.map((n) => {
    const networkPins = pinsByNetwork.get(n.id) ?? [];
    return {
      id: n.id,
      name: n.name,
      enabled: n.enabled,
      airtimeDiscount: Number(n.airtime_discount),
      enabledTypes: (enabledByNetwork.get(n.id) ?? []).map((r) => r.type_id),
      plans: (plansByNetwork.get(n.id) ?? []).map(toPlan),
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

export async function setAirtimeDiscount(id: string, percent: number) {
  return changed(await getPool().query("update networks set airtime_discount = $2 where id = $1", [id, percent]));
}

export async function deleteNetwork(id: string) {
  return changed(await getPool().query("delete from networks where id = $1", [id]));
}

export async function createDataType(id: string, label: string) {
  return changed(await getPool().query("insert into data_types (id, label) values ($1, $2)", [id, label]));
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
  return changed(
    await getPool().query("delete from data_plans where id = $1 and network_id = $2", [planId, network]),
  );
}
