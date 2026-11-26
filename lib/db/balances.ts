import "server-only";
import { getPool } from "@/lib/db";

export type BalanceState = "unknown" | "ok" | "low" | "error";

export type BalanceRow = {
  providerId: string;
  providerName: string;
  threshold: number | null;
  balance: number | null;
  state: BalanceState;
  failures: number;
  lastError: string | null;
  checkedAt: string | null;
  lastAlertedAt: Date | null;
  alertedState: string | null;
};

type Row = {
  provider_id: string;
  provider_name: string;
  threshold: string | null;
  balance: string | null;
  state: BalanceState | null;
  failures: number | null;
  last_error: string | null;
  checked_at: Date | null;
  last_alerted_at: Date | null;
  alerted_state: string | null;
};

const toRow = (r: Row): BalanceRow => ({
  providerId: r.provider_id,
  providerName: r.provider_name,
  threshold: r.threshold === null ? null : Number(r.threshold),
  balance: r.balance === null ? null : Number(r.balance),
  state: r.state ?? "unknown",
  failures: r.failures ?? 0,
  lastError: r.last_error,
  checkedAt: r.checked_at?.toISOString() ?? null,
  lastAlertedAt: r.last_alerted_at,
  alertedState: r.alerted_state,
});

const SELECT = `select p.id as provider_id, p.name as provider_name, b.threshold, b.balance, b.state,
       b.consecutive_failures as failures, b.last_error, b.checked_at, b.last_alerted_at, b.alerted_state
     from providers p
     left join provider_balance b on b.provider_id = p.id`;

export async function listMonitored(onlyProviderId?: string): Promise<BalanceRow[]> {
  const { rows } = await getPool().query<Row>(
    `${SELECT}
     where p.enabled
       and exists (select 1 from provider_endpoints e where e.provider_id = p.id and e.service = 'balance' and e.active)
       and ($1::text is null or p.id = $1)
     order by p.priority, p.name`,
    [onlyProviderId ?? null],
  );
  return rows.map(toRow);
}

export async function listAllBalances(): Promise<(BalanceRow & { monitored: boolean })[]> {
  const { rows } = await getPool().query<Row & { monitored: boolean }>(
    `select x.*, exists (
        select 1 from provider_endpoints e where e.provider_id = x.provider_id and e.service = 'balance' and e.active
      ) as monitored
     from (${SELECT}) x
     order by x.provider_name`,
  );
  return rows.map((r) => ({ ...toRow(r), monitored: r.monitored }));
}

export async function saveCheck(
  providerId: string,
  result: { balance: number | null; state: BalanceState; failures: number; error: string | null },
): Promise<void> {
  await getPool().query(
    `insert into provider_balance (provider_id, balance, state, consecutive_failures, last_error, checked_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (provider_id) do update
       set balance = coalesce($2, provider_balance.balance),
           state = $3, consecutive_failures = $4, last_error = $5, checked_at = now(), updated_at = now()`,
    [providerId, result.balance, result.state, result.failures, result.error],
  );
}

export async function claimAlert(
  providerId: string,
  state: BalanceState,
  previous: { lastAlertedAt: Date | null; alertedState: string | null },
): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `update provider_balance set last_alerted_at = now(), alerted_state = $2
     where provider_id = $1
       and last_alerted_at is not distinct from $3
       and alerted_state is not distinct from $4`,
    [providerId, state, previous.lastAlertedAt, previous.alertedState],
  );
  return (rowCount ?? 0) > 0;
}

export async function setThreshold(providerId: string, threshold: number | null): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `insert into provider_balance (provider_id, threshold)
     select id, $2 from providers where id = $1
     on conflict (provider_id) do update set threshold = $2, updated_at = now()`,
    [providerId, threshold],
  );
  return (rowCount ?? 0) > 0;
}

export type AlertRecipient = { id: string; email: string | null; phone: string | null };

export async function listAlertRecipients(): Promise<AlertRecipient[]> {
  const { rows } = await getPool().query<AlertRecipient>(
    `select distinct c.id, c.email, c.phone
     from staff_members s
     join roles r on r.id = s.role_id
     join customers c on c.id = s.customer_id and c.status = 'active'
     where r.is_owner
        or exists (select 1 from role_permissions rp where rp.role_id = r.id and rp.permission = 'settings.manage')`,
  );
  return rows;
}
