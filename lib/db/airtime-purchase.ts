import "server-only";
import { getPool } from "@/lib/db";
import type { AirtimeCatalogNetwork, AirtimeCatalogType, AirtimeRange } from "@/lib/airtime-purchase";

/** Only offers enabled networks and types with an active airtime provider endpoint. */
export async function getAirtimeCatalog(): Promise<AirtimeCatalogNetwork[]> {
  const pool = getPool();
  const [networks, types, ranges] = await Promise.all([
    pool.query<{ id: string; name: string }>("select id, name from networks where enabled order by sort_order, name"),
    pool.query<{ network_id: string; id: string; label: string }>(
      `select nt.network_id, t.id, t.label
       from network_data_types nt
       join data_types t on t.id = nt.type_id
       where nt.enabled and t.service = 'airtime'
       order by t.created_at, t.label`,
    ),
    pool.query<{
      network_id: string;
      type_id: string;
      min_amount: string;
      max_amount: string;
      discount: string;
    }>(
      `select d.network_id, d.type_id, d.min_amount, d.max_amount, d.discount
       from airtime_discounts d
       where d.active
         and exists (
           select 1
           from providers pr
           join provider_endpoints e on e.provider_id = pr.id and e.service = 'airtime' and e.active
           where pr.enabled and (d.provider_id is null or pr.id = d.provider_id))
       order by d.min_amount`,
    ),
  ]);

  const rangesByType = new Map<string, AirtimeRange[]>();
  for (const row of ranges.rows) {
    const key = `${row.network_id}:${row.type_id}`;
    const list = rangesByType.get(key) ?? [];
    list.push({ min: Number(row.min_amount), max: Number(row.max_amount), discount: Number(row.discount) });
    rangesByType.set(key, list);
  }

  const typesByNetwork = new Map<string, AirtimeCatalogType[]>();
  for (const row of types.rows) {
    const typeRanges = rangesByType.get(`${row.network_id}:${row.id}`) ?? [];
    if (typeRanges.length === 0) continue;
    const list = typesByNetwork.get(row.network_id) ?? [];
    list.push({ id: row.id, label: row.label, ranges: typeRanges });
    typesByNetwork.set(row.network_id, list);
  }

  return networks.rows
    .map((network) => ({
      id: network.id,
      name: network.name,
      types: typesByNetwork.get(network.id) ?? [],
    }))
    .filter((network) => network.types.length > 0);
}

export type AirtimeQuote = {
  networkName: string;
  typeLabel: string;
  discount: number;
  providerId: string | null;
  providerDiscount: number | null;
};

/** The active discount range for this network, type and amount, or null if unavailable. */
export async function getAirtimeQuote(
  networkId: string,
  typeId: string,
  amount: number,
): Promise<AirtimeQuote | null> {
  const { rows } = await getPool().query<{
    network_name: string;
    type_label: string;
    discount: string;
    provider_id: string | null;
    provider_discount: string | null;
  }>(
    `select n.name as network_name, t.label as type_label, d.discount, d.provider_id, d.provider_discount
     from networks n
     join network_data_types nt on nt.network_id = n.id and nt.type_id = $2 and nt.enabled
     join data_types t on t.id = nt.type_id and t.service = 'airtime'
     join airtime_discounts d on d.network_id = n.id and d.type_id = t.id and d.active
                             and d.min_amount <= $3 and d.max_amount >= $3
     where n.id = $1 and n.enabled
     limit 1`,
    [networkId, typeId, amount],
  );
  const row = rows[0];
  return row
    ? {
        networkName: row.network_name,
        typeLabel: row.type_label,
        discount: Number(row.discount),
        providerId: row.provider_id,
        providerDiscount: row.provider_discount === null ? null : Number(row.provider_discount),
      }
    : null;
}

export async function pickAirtimeProvider(preferredId: string | null): Promise<string | null> {
  const { rows } = await getPool().query<{ id: string }>(
    `select p.id
     from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'airtime' and e.active
     where p.enabled and ($1::text is null or p.id = $1)
     order by p.priority, p.name
     limit 1`,
    [preferredId],
  );
  return rows[0]?.id ?? null;
}
