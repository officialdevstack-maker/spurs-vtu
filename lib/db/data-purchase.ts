import "server-only";
import { getPool } from "@/lib/db";
import { resolvePackagePrice, type PriceMode } from "@/lib/admin/airtime-data";
import type { CustomerStatus } from "@/lib/db/customers";
import type { CatalogNetwork, CatalogPlan, CatalogType } from "@/lib/data-purchase";

export async function getCustomerForPurchase(id: string) {
  const { rows } = await getPool().query<{
    status: CustomerStatus;
    package_id: string;
    phone: string | null;
  }>("select status, package_id, phone from customers where id = $1", [id]);
  const row = rows[0];
  return row ? { status: row.status, packageId: row.package_id, phone: row.phone } : null;
}

export async function getDataCatalog(packageId: string): Promise<CatalogNetwork[]> {
  const pool = getPool();
  const [networks, types, plans, prices] = await Promise.all([
    pool.query<{ id: string; name: string }>("select id, name from networks where enabled order by sort_order, name"),
    pool.query<{ network_id: string; id: string; label: string }>(
      `select nt.network_id, t.id, t.label
       from network_data_types nt
       join data_types t on t.id = nt.type_id
       where nt.enabled and t.service = 'data'
       order by t.created_at, t.label`,
    ),
    pool.query<{
      id: string;
      network_id: string;
      type_id: string;
      size: string;
      validity: string;
      price: string;
    }>(
      `select p.id, p.network_id, p.type_id, p.size, p.validity, p.price
       from data_plans p
       where p.active
         and exists (
           select 1 from providers pr
           join provider_endpoints e on e.provider_id = pr.id and e.service = 'data' and e.active
           where pr.enabled and (p.provider_id is null or pr.id = p.provider_id))
       order by case when p.unit = 'gb' then p.volume * 1024 else p.volume end nulls last, p.price`,
    ),
    pool.query<{ plan_id: string; mode: PriceMode; value: string }>(
      "select plan_id, mode, value from data_plan_package_prices where package_id = $1",
      [packageId],
    ),
  ]);

  const typesByNetwork = new Map<string, CatalogType[]>();
  for (const row of types.rows) {
    const list = typesByNetwork.get(row.network_id) ?? [];
    list.push({ id: row.id, label: row.label });
    typesByNetwork.set(row.network_id, list);
  }

  const overrides = new Map(prices.rows.map((row) => [row.plan_id, row]));
  const plansByNetwork = new Map<string, CatalogPlan[]>();
  for (const row of plans.rows) {
    if (!typesByNetwork.get(row.network_id)?.some((type) => type.id === row.type_id)) continue;
    const standardPrice = Number(row.price);
    const override = overrides.get(row.id);
    const list = plansByNetwork.get(row.network_id) ?? [];
    list.push({
      id: row.id,
      typeId: row.type_id,
      size: row.size,
      validity: row.validity,
      price: override ? resolvePackagePrice(standardPrice, override.mode, Number(override.value)) : standardPrice,
      standardPrice,
    });
    plansByNetwork.set(row.network_id, list);
  }

  return networks.rows
    .map((network) => {
      const networkPlans = plansByNetwork.get(network.id) ?? [];
      return {
        id: network.id,
        name: network.name,
        types: (typesByNetwork.get(network.id) ?? []).filter((type) =>
          networkPlans.some((plan) => plan.typeId === type.id),
        ),
        plans: networkPlans,
      };
    })
    .filter((network) => network.plans.length > 0);
}

export type PurchasablePlan = {
  id: string;
  networkId: string;
  networkName: string;
  typeLabel: string;
  size: string;
  cost: number;
  providerId: string | null;
  providerPlanId: string;
};

export async function getPurchasablePlan(planId: string): Promise<PurchasablePlan | null> {
  const { rows } = await getPool().query<{
    id: string;
    network_id: string;
    network_name: string;
    type_label: string;
    size: string;
    cost: string;
    provider_id: string | null;
    provider_plan_id: string;
  }>(
    `select p.id, p.network_id, n.name as network_name, t.label as type_label, p.size, p.cost,
            p.provider_id, p.provider_plan_id
     from data_plans p
     join networks n on n.id = p.network_id and n.enabled
     join network_data_types nt on nt.network_id = p.network_id and nt.type_id = p.type_id and nt.enabled
     join data_types t on t.id = p.type_id and t.service = 'data'
     where p.id = $1 and p.active`,
    [planId],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        networkId: row.network_id,
        networkName: row.network_name,
        typeLabel: row.type_label,
        size: row.size,
        cost: Number(row.cost),
        providerId: row.provider_id,
        providerPlanId: row.provider_plan_id,
      }
    : null;
}

export async function pickDataProvider(preferredId: string | null): Promise<string | null> {
  const { rows } = await getPool().query<{ id: string }>(
    `select p.id
     from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'data' and e.active
     where p.enabled and ($1::text is null or p.id = $1)
     order by p.priority, p.name
     limit 1`,
    [preferredId],
  );
  return rows[0]?.id ?? null;
}
