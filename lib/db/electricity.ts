import "server-only";
import { getPool } from "@/lib/db";
import type { ProviderOption } from "@/lib/admin/airtime-data";
import type { Disco } from "@/lib/admin/electricity";
import type { ElectricityDisco } from "@/lib/electricity-purchase";

export type DiscoFields = {
  name: string;
  providerCode: string;
  discount: number;
  providerId: string | null;
  providerDiscount: number | null;
  minAmount: number;
  maxAmount: number;
  enabled: boolean;
};

type DiscoRow = {
  id: string;
  name: string;
  provider_code: string;
  enabled: boolean;
  discount: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_discount: string | null;
  min_amount: string;
  max_amount: string;
};

const dbFail = (code: "BAD_PROVIDER") => Object.assign(new Error(code), { code });
const changed = (r: { rowCount: number | null }) => (r.rowCount ?? 0) > 0;

const toDisco = (r: DiscoRow): Disco => ({
  id: r.id,
  name: r.name,
  providerCode: r.provider_code,
  enabled: r.enabled,
  discount: Number(r.discount),
  providerId: r.provider_id,
  providerName: r.provider_name,
  providerDiscount: r.provider_discount === null ? null : Number(r.provider_discount),
  minAmount: Number(r.min_amount),
  maxAmount: Number(r.max_amount),
});

export async function getDiscos(): Promise<Disco[]> {
  const { rows } = await getPool().query<DiscoRow>(
    `select d.id, d.name, d.provider_code, d.enabled, d.discount, d.provider_id, p.name as provider_name,
            d.provider_discount, d.min_amount, d.max_amount
     from electricity_discos d
     left join providers p on p.id = d.provider_id
     order by d.sort_order, d.name`,
  );
  return rows.map(toDisco);
}

export async function listElectricityProviders(): Promise<ProviderOption[]> {
  const { rows } = await getPool().query<ProviderOption>(
    `select p.id, p.name from providers p
     where p.enabled and exists (
       select 1 from provider_endpoints e
       where e.provider_id = p.id and e.service = 'electricity' and e.active)
     order by p.priority, p.name`,
  );
  return rows;
}

async function checkDisco(d: DiscoFields) {
  if (!d.providerId) return;
  const provider = await getPool().query(
    `select 1 from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'electricity'
     where p.id = $1`,
    [d.providerId],
  );
  if (!provider.rowCount) throw dbFail("BAD_PROVIDER");
}

export async function createDisco(id: string, d: DiscoFields): Promise<boolean> {
  await checkDisco(d);
  return changed(
    await getPool().query(
      `insert into electricity_discos
         (id, name, provider_code, enabled, discount, provider_id, provider_discount, min_amount, max_amount, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               (select coalesce(max(sort_order), 0) + 1 from electricity_discos))`,
      [id, d.name, d.providerCode, d.enabled, d.discount, d.providerId, d.providerDiscount, d.minAmount, d.maxAmount],
    ),
  );
}

export async function updateDisco(id: string, d: DiscoFields): Promise<boolean> {
  await checkDisco(d);
  return changed(
    await getPool().query(
      `update electricity_discos
       set name = $2, provider_code = $3, enabled = $4, discount = $5, provider_id = $6,
           provider_discount = $7, min_amount = $8, max_amount = $9
       where id = $1`,
      [id, d.name, d.providerCode, d.enabled, d.discount, d.providerId, d.providerDiscount, d.minAmount, d.maxAmount],
    ),
  );
}

export async function setDiscoEnabled(id: string, enabled: boolean): Promise<boolean> {
  return changed(await getPool().query("update electricity_discos set enabled = $2 where id = $1", [id, enabled]));
}

export async function deleteDisco(id: string): Promise<boolean> {
  return changed(await getPool().query("delete from electricity_discos where id = $1", [id]));
}

export async function getElectricityCatalog(): Promise<ElectricityDisco[]> {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    min_amount: string;
    max_amount: string;
    discount: string;
  }>(
    `select d.id, d.name, d.min_amount, d.max_amount, d.discount
     from electricity_discos d
     where d.enabled
       and exists (
         select 1
         from providers pr
         join provider_endpoints e on e.provider_id = pr.id and e.service = 'electricity' and e.active
         where pr.enabled and (d.provider_id is null or pr.id = d.provider_id))
     order by d.sort_order, d.name`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    min: Number(row.min_amount),
    max: Number(row.max_amount),
    discount: Number(row.discount),
  }));
}

export type ElectricityQuote = {
  name: string;
  providerCode: string;
  discount: number;
  providerId: string | null;
  providerDiscount: number | null;
};

export async function getElectricityQuote(discoId: string, amount: number): Promise<ElectricityQuote | null> {
  const { rows } = await getPool().query<{
    name: string;
    provider_code: string;
    discount: string;
    provider_id: string | null;
    provider_discount: string | null;
  }>(
    `select name, provider_code, discount, provider_id, provider_discount
     from electricity_discos
     where id = $1 and enabled and min_amount <= $2 and max_amount >= $2`,
    [discoId, amount],
  );
  const row = rows[0];
  return row
    ? {
        name: row.name,
        providerCode: row.provider_code,
        discount: Number(row.discount),
        providerId: row.provider_id,
        providerDiscount: row.provider_discount === null ? null : Number(row.provider_discount),
      }
    : null;
}

export async function pickElectricityProvider(preferredId: string | null): Promise<string | null> {
  const { rows } = await getPool().query<{ id: string }>(
    `select p.id
     from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'electricity' and e.active
     where p.enabled and ($1::text is null or p.id = $1)
     order by p.priority, p.name
     limit 1`,
    [preferredId],
  );
  return rows[0]?.id ?? null;
}
