import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import type { Vars } from "@/lib/providers/fill";

export type Route = { providerId: string; vars: Vars; cost: number | null };
type PlanService = "data" | "cable";

export async function airtimeAlternates(excludeProviderId: string, vars: Vars): Promise<Route[]> {
  const { rows } = await getPool().query<{ id: string }>(
    `select p.id from providers p
     join provider_endpoints e on e.provider_id = p.id and e.service = 'airtime' and e.active
     where p.enabled and p.id <> $1
     order by p.priority, p.name`,
    [excludeProviderId],
  );
  return rows.map((row) => ({ providerId: row.id, vars, cost: null }));
}

export async function planAlternates(
  service: PlanService,
  planId: string,
  excludeProviderId: string,
  vars: Vars,
): Promise<Route[]> {
  const { rows } = await getPool().query<{ provider_id: string; provider_plan_id: string; cost: string }>(
    `select c.provider_id, c.provider_plan_id, c.cost
     from plan_provider_codes c
     join providers p on p.id = c.provider_id and p.enabled
     join provider_endpoints e on e.provider_id = p.id and e.service = $1 and e.active
     where c.service = $1 and c.plan_id = $2 and c.provider_id <> $3
     order by p.priority, p.name`,
    [service, planId, excludeProviderId],
  );
  return rows.map((row) => ({
    providerId: row.provider_id,
    cost: Number(row.cost),
    vars: { ...vars, plan: row.provider_plan_id, amount: Number(row.cost) },
  }));
}

export async function switchProvider(transactionId: string, providerId: string, cost: number | null): Promise<void> {
  const { rowCount } = await getPool().query(
    "update transactions set provider_id = $2, cost = $3, updated_at = now() where id = $1 and status = 'pending'",
    [transactionId, providerId, cost],
  );
  if (!rowCount) throw new Error("Transaction is no longer pending; not switching provider.");
}

export async function recordAttempt(a: {
  transactionId: string;
  attempt: number;
  providerId: string;
  outcome: "success" | "failed" | "pending" | "not_sent";
  httpStatus: number | null;
}): Promise<void> {
  await getPool().query(
    `insert into transaction_attempts (id, transaction_id, attempt, provider_id, outcome, http_status)
     values ($1, $2, $3, $4, $5, $6) on conflict (transaction_id, attempt) do nothing`,
    [randomUUID(), a.transactionId, a.attempt, a.providerId, a.outcome, a.httpStatus],
  );
}

export type PlanProviderCode = { providerId: string; providerPlanId: string; cost: number };

export async function listPlanProviderCodes(service: PlanService, planId: string): Promise<PlanProviderCode[]> {
  const { rows } = await getPool().query<{ provider_id: string; provider_plan_id: string; cost: string }>(
    "select provider_id, provider_plan_id, cost from plan_provider_codes where service = $1 and plan_id = $2 order by provider_id",
    [service, planId],
  );
  return rows.map((row) => ({
    providerId: row.provider_id,
    providerPlanId: row.provider_plan_id,
    cost: Number(row.cost),
  }));
}

export async function savePlanProviderCodes(service: PlanService, planId: string, codes: PlanProviderCode[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("delete from plan_provider_codes where service = $1 and plan_id = $2", [service, planId]);
    if (codes.length > 0) {
      await client.query(
        `insert into plan_provider_codes (service, plan_id, provider_id, provider_plan_id, cost)
         select $1, $2, t.provider_id, t.provider_plan_id, t.cost
         from unnest($3::text[], $4::text[], $5::numeric[]) as t(provider_id, provider_plan_id, cost)`,
        [service, planId, codes.map((code) => code.providerId), codes.map((code) => code.providerPlanId), codes.map((code) => code.cost)],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
