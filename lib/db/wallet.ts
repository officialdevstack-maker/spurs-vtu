import "server-only";
import { getPool } from "@/lib/db";
import type { PoolClient } from "pg";

type WalletChange = {
  customerId: string;
  amountKobo: number;
  reference: string;
  direction: "debit" | "credit";
  source: string;
};

function assertAmount(amountKobo: number): void {
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error("Wallet amounts must be positive whole kobo.");
  }
}

type DepositProvider = "flutterwave" | "paymentpoint";
type DepositPolicy = {
  feeType: "flat" | "percentage";
  feeValue: string;
  minimumDepositKobo: bigint;
};

async function getDepositPolicy(client: PoolClient, provider: DepositProvider): Promise<DepositPolicy> {
  const { rows } = await client.query<{
    deposit_fee_type: "flat" | "percentage";
    deposit_fee_value: string;
    minimum_deposit_kobo: string;
  }>(
    `select deposit_fee_type, deposit_fee_value::text, minimum_deposit_kobo::text
     from payment_providers where id = $1 for share`,
    [provider],
  );
  const row = rows[0];
  return row
    ? {
        feeType: row.deposit_fee_type,
        feeValue: row.deposit_fee_value,
        minimumDepositKobo: BigInt(row.minimum_deposit_kobo),
      }
    : { feeType: "flat", feeValue: "0.00", minimumDepositKobo: 10_000n };
}

function decimalToMinorUnits(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error("Saved deposit fee is invalid.");
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function calculateDepositFeeKobo(amountKobo: number, policy: DepositPolicy): bigint {
  const amount = BigInt(amountKobo);
  const feeValue = decimalToMinorUnits(policy.feeValue);
  if (policy.feeType === "flat") return feeValue;
  return (amount * feeValue + 5_000n) / 10_000n;
}

function depositReviewReason(
  amountKobo: number,
  expectedAmountKobo: string | null,
  feeKobo: bigint,
  minimumDepositKobo: bigint,
): string | null {
  if (expectedAmountKobo !== null && BigInt(expectedAmountKobo) !== BigInt(amountKobo)) {
    return "Manual review required: received amount did not match the requested deposit.";
  }
  if (BigInt(amountKobo) < minimumDepositKobo) {
    return "Manual review required: received amount was below the provider minimum.";
  }
  if (feeKobo >= BigInt(amountKobo)) {
    return "Manual review required: configured fee would consume the entire deposit.";
  }
  return null;
}

function depositHistoryDetail(isTemporary: boolean, feeKobo: bigint): string {
  const detail = isTemporary ? "Temporary bank transfer" : "Bank transfer";
  return feeKobo > 0n ? `${detail} · Deposit fee ₦${(Number(feeKobo) / 100).toFixed(2)}` : detail;
}

export async function getWalletBalanceKobo(customerId: string): Promise<bigint> {
  const pool = getPool();
  const { rows } = await pool.query<{ balance_kobo: string }>(
    `select coalesce(w.balance_kobo, 0)::text as balance_kobo
     from customers c left join vtu_wallets w on w.customer_id = c.id
     where c.id = $1`,
    [customerId],
  );
  const balance = rows[0];
  if (!balance) throw new Error("Wallet balance query did not return a row.");
  return BigInt(balance.balance_kobo);
}

export async function changeWalletBalance(input: WalletChange): Promise<boolean> {
  assertAmount(input.amountKobo);
  if (!input.customerId || !input.reference || !input.source) {
    throw new Error("Wallet changes require a customer, reference and source.");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into vtu_wallets (customer_id) values ($1)
       on conflict (customer_id) do nothing`,
      [input.customerId],
    );
    const wallet = await client.query<{ balance_kobo: string }>(
      "select balance_kobo::text from vtu_wallets where customer_id = $1 for update",
      [input.customerId],
    );
    const row = wallet.rows[0];
    if (!row) throw new Error("Wallet was not created.");

    const prior = await client.query<{
      customer_id: string;
      direction: "debit" | "credit";
      amount_kobo: string;
      source: string;
    }>(
      "select customer_id, direction, amount_kobo::text, source from vtu_wallet_ledger where reference = $1",
      [input.reference],
    );
    const existing = prior.rows[0];
    if (existing) {
      if (
        existing.customer_id !== input.customerId ||
        existing.direction !== input.direction ||
        BigInt(existing.amount_kobo) !== BigInt(input.amountKobo) ||
        existing.source !== input.source
      ) {
        throw new Error("Wallet idempotency reference was reused with different details.");
      }
      await client.query("commit");
      return true;
    }

    const balance = BigInt(row.balance_kobo);
    if (input.direction === "debit" && balance < BigInt(input.amountKobo)) {
      await client.query("rollback");
      return false;
    }

    const ledger = await client.query(
      `insert into vtu_wallet_ledger (reference, customer_id, direction, amount_kobo, source)
       values ($1, $2, $3, $4, $5)
       on conflict (reference) do nothing
       returning reference`,
      [input.reference, input.customerId, input.direction, input.amountKobo, input.source],
    );
    if ((ledger.rowCount ?? 0) !== 1) {
      const conflicting = await client.query<{
        customer_id: string;
        direction: "debit" | "credit";
        amount_kobo: string;
        source: string;
      }>(
        "select customer_id, direction, amount_kobo::text, source from vtu_wallet_ledger where reference = $1",
        [input.reference],
      );
      const priorEntry = conflicting.rows[0];
      if (
        !priorEntry ||
        priorEntry.customer_id !== input.customerId ||
        priorEntry.direction !== input.direction ||
        BigInt(priorEntry.amount_kobo) !== BigInt(input.amountKobo) ||
        priorEntry.source !== input.source
      ) {
        throw new Error("Wallet idempotency reference conflicts with an existing transaction.");
      }
      await client.query("commit");
      return true;
    }

    const delta = input.direction === "credit" ? input.amountKobo : -input.amountKobo;
    await client.query(
      `update vtu_wallets
       set balance_kobo = balance_kobo + $2, updated_at = now()
       where customer_id = $1`,
      [input.customerId, delta],
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

export type FlutterwaveAccount = {
  customerId: string;
  txRef: string;
  accountNumber: string | null;
  bankName: string | null;
  accountName: string | null;
  status: "creating" | "active";
};

function accountFromRow(row: {
  customer_id: string;
  tx_ref: string;
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  status: "creating" | "active";
}): FlutterwaveAccount {
  return {
    customerId: row.customer_id,
    txRef: row.tx_ref,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    accountName: row.account_name,
    status: row.status,
  };
}

export async function getFlutterwaveAccount(customerId: string): Promise<FlutterwaveAccount | null> {
  const { rows } = await getPool().query<{
    customer_id: string;
    tx_ref: string;
    account_number: string | null;
    bank_name: string | null;
    account_name: string | null;
    status: "creating" | "active";
  }>(
    `select customer_id, tx_ref, account_number, bank_name, account_name, status
     from flutterwave_virtual_accounts where customer_id = $1`,
    [customerId],
  );
  return rows[0] ? accountFromRow(rows[0]) : null;
}

export async function reserveFlutterwaveAccount(
  customerId: string,
  txRef: string,
): Promise<FlutterwaveAccount> {
  const { rows } = await getPool().query<{
    customer_id: string;
    tx_ref: string;
    account_number: string | null;
    bank_name: string | null;
    account_name: string | null;
    status: "creating" | "active";
  }>(
    `insert into flutterwave_virtual_accounts (customer_id, tx_ref)
     values ($1, $2)
     on conflict (customer_id) do update set customer_id = excluded.customer_id
     returning customer_id, tx_ref, account_number, bank_name, account_name, status`,
    [customerId, txRef],
  );
  const row = rows[0];
  if (!row) throw new Error("Could not reserve a Flutterwave account.");
  return accountFromRow(row);
}

export async function saveFlutterwaveAccount(input: {
  customerId: string;
  txRef: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
}): Promise<FlutterwaveAccount> {
  const { rows } = await getPool().query<{
    customer_id: string;
    tx_ref: string;
    account_number: string | null;
    bank_name: string | null;
    account_name: string | null;
    status: "creating" | "active";
  }>(
    `update flutterwave_virtual_accounts
     set account_number = $3, bank_name = $4, account_name = $5, status = 'active'
     where customer_id = $1 and tx_ref = $2
     returning customer_id, tx_ref, account_number, bank_name, account_name, status`,
    [input.customerId, input.txRef, input.accountNumber, input.bankName, input.accountName],
  );
  const row = rows[0];
  if (!row) throw new Error("Flutterwave account reservation was not found.");
  return accountFromRow(row);
}

export type PaymentPointAccount = {
  customerId: string;
  accountNumber: string | null;
  bankName: string | null;
  accountName: string | null;
  status: "creating" | "active";
};

function paymentPointAccountFromRow(row: {
  customer_id: string;
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  status: "creating" | "active";
}): PaymentPointAccount {
  return {
    customerId: row.customer_id,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    accountName: row.account_name,
    status: row.status,
  };
}

export async function getPaymentPointAccount(customerId: string): Promise<PaymentPointAccount | null> {
  const { rows } = await getPool().query<{
    customer_id: string;
    account_number: string | null;
    bank_name: string | null;
    account_name: string | null;
    status: "creating" | "active";
  }>(
    `select customer_id, account_number, bank_name, account_name, status
     from paymentpoint_virtual_accounts where customer_id = $1`,
    [customerId],
  );
  return rows[0] ? paymentPointAccountFromRow(rows[0]) : null;
}

export async function reservePaymentPointAccount(
  customerId: string,
): Promise<{ account: PaymentPointAccount; created: boolean }> {
  const inserted = await getPool().query<{
    customer_id: string;
    account_number: string | null;
    bank_name: string | null;
    account_name: string | null;
    status: "creating" | "active";
  }>(
    `insert into paymentpoint_virtual_accounts (customer_id)
     values ($1)
     on conflict (customer_id) do nothing
     returning customer_id, account_number, bank_name, account_name, status`,
    [customerId],
  );
  if (inserted.rows[0]) {
    return { account: paymentPointAccountFromRow(inserted.rows[0]), created: true };
  }
  const account = await getPaymentPointAccount(customerId);
  if (!account) throw new Error("Could not reserve a PaymentPoint account.");
  return { account, created: false };
}

export async function savePaymentPointAccount(input: {
  customerId: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  reservedAccountId: string | null;
}): Promise<PaymentPointAccount> {
  const { rows } = await getPool().query<{
    customer_id: string;
    account_number: string | null;
    bank_name: string | null;
    account_name: string | null;
    status: "creating" | "active";
  }>(
    `update paymentpoint_virtual_accounts
     set account_number = $2, bank_name = $3, account_name = $4,
         reserved_account_id = $5, status = 'active'
     where customer_id = $1 and status = 'creating'
     returning customer_id, account_number, bank_name, account_name, status`,
    [input.customerId, input.accountNumber, input.bankName, input.accountName, input.reservedAccountId],
  );
  const row = rows[0];
  if (!row) throw new Error("PaymentPoint account reservation was not found.");
  return paymentPointAccountFromRow(row);
}

export async function deleteCreatingPaymentPointAccount(customerId: string): Promise<void> {
  await getPool().query(
    "delete from paymentpoint_virtual_accounts where customer_id = $1 and status = 'creating'",
    [customerId],
  );
}

export async function createPaymentPointFundingIntent(input: {
  reference: string;
  customerId: string;
  amountKobo: number;
}): Promise<FundingIntent> {
  assertAmount(input.amountKobo);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{
      reference: string;
      amount_kobo: string;
      account_number: string | null;
      bank_name: string | null;
      status: FundingIntent["status"];
    }>(
      `insert into paymentpoint_funding_intents (reference, customer_id, amount_kobo)
       values ($1, $2, $3)
       returning reference, amount_kobo::text, account_number, bank_name, status`,
      [input.reference, input.customerId, input.amountKobo],
    );
    const row = rows[0];
    if (!row) throw new Error("PaymentPoint funding intent was not created.");
    await client.query(
      `insert into transactions (id, customer_id, service, title, detail, amount, direction, status)
       values ($1, $2, 'wallet', 'Wallet funding', 'Temporary transfer account', $3, 'credit', 'pending')`,
      [input.reference, input.customerId, input.amountKobo / 100],
    );
    await client.query("commit");
    return {
      reference: row.reference,
      amountKobo: Number(row.amount_kobo),
      accountNumber: row.account_number,
      bankName: row.bank_name,
      status: row.status,
      expiresAt: null,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function savePaymentPointFundingIntentAccount(input: {
  reference: string;
  customerId: string;
  accountNumber: string;
  bankName: string;
}): Promise<FundingIntent> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{
      reference: string;
      amount_kobo: string;
      account_number: string | null;
      bank_name: string | null;
      status: FundingIntent["status"];
    }>(
      `update paymentpoint_funding_intents
       set account_number = $3, bank_name = $4, status = 'pending', updated_at = now()
       where reference = $1 and customer_id = $2 and status = 'creating'
       returning reference, amount_kobo::text, account_number, bank_name, status`,
      [input.reference, input.customerId, input.accountNumber, input.bankName],
    );
    const row = rows[0];
    if (!row) throw new Error("PaymentPoint funding intent could not be updated.");
    const transaction = await client.query(
      `update transactions set detail = $2, updated_at = now()
       where id = $1 and customer_id = $3 and status = 'pending'`,
      [input.reference, `Temporary transfer account ${input.accountNumber}`, input.customerId],
    );
    if ((transaction.rowCount ?? 0) !== 1) throw new Error("PaymentPoint funding transaction was not found.");
    await client.query("commit");
    return {
      reference: row.reference,
      amountKobo: Number(row.amount_kobo),
      accountNumber: row.account_number,
      bankName: row.bank_name,
      status: row.status,
      expiresAt: null,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function failPaymentPointFundingIntent(reference: string, customerId: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `update paymentpoint_funding_intents set status = 'failed', updated_at = now()
       where reference = $1 and customer_id = $2 and status = 'creating'`,
      [reference, customerId],
    );
    await client.query(
      `update transactions set status = 'failed', updated_at = now()
       where id = $1 and customer_id = $2 and status = 'pending'`,
      [reference, customerId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRecentPaymentPointFundingIntents(customerId: string, limit = 3): Promise<FundingIntent[]> {
  const { rows } = await getPool().query<{
    reference: string;
    amount_kobo: string;
    account_number: string | null;
    bank_name: string | null;
    status: FundingIntent["status"];
  }>(
    `select reference, amount_kobo::text, account_number, bank_name, status
     from paymentpoint_funding_intents
     where customer_id = $1 and status in ('creating', 'pending', 'review')
     order by created_at desc limit $2`,
    [customerId, limit],
  );
  return rows.map((row) => ({
    reference: row.reference,
    amountKobo: Number(row.amount_kobo),
    accountNumber: row.account_number,
    bankName: row.bank_name,
    status: row.status,
    expiresAt: null,
  }));
}

export type FundingIntent = {
  reference: string;
  amountKobo: number;
  accountNumber: string | null;
  bankName: string | null;
  status: "creating" | "pending" | "completed" | "failed" | "review";
  expiresAt: string | null;
};

function fundingIntentFromRow(row: {
  reference: string;
  amount_kobo: string;
  account_number: string | null;
  bank_name: string | null;
  status: FundingIntent["status"];
  expires_at: Date | null;
}): FundingIntent {
  return {
    reference: row.reference,
    amountKobo: Number(row.amount_kobo),
    accountNumber: row.account_number,
    bankName: row.bank_name,
    status: row.status,
    expiresAt: row.expires_at?.toISOString() ?? null,
  };
}

export async function createFundingIntent(input: {
  reference: string;
  customerId: string;
  amountKobo: number;
}): Promise<FundingIntent> {
  assertAmount(input.amountKobo);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{
      reference: string;
      amount_kobo: string;
      account_number: string | null;
      bank_name: string | null;
      status: FundingIntent["status"];
      expires_at: Date | null;
    }>(
      `insert into flutterwave_funding_intents (reference, customer_id, amount_kobo)
       values ($1, $2, $3)
       returning reference, amount_kobo::text, account_number, bank_name, status, expires_at`,
      [input.reference, input.customerId, input.amountKobo],
    );
    const row = rows[0];
    if (!row) throw new Error("Funding intent was not created.");
    await client.query(
      `insert into transactions (id, customer_id, service, title, detail, amount, direction, status)
       values ($1, $2, 'wallet', 'Wallet funding', 'Temporary transfer account', $3, 'credit', 'pending')`,
      [input.reference, input.customerId, input.amountKobo / 100],
    );
    await client.query("commit");
    return fundingIntentFromRow(row);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveFundingIntentAccount(input: {
  reference: string;
  customerId: string;
  accountNumber: string;
  bankName: string;
  expiresAt: string | null;
}): Promise<FundingIntent> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{
      reference: string;
      amount_kobo: string;
      account_number: string | null;
      bank_name: string | null;
      status: FundingIntent["status"];
      expires_at: Date | null;
    }>(
      `update flutterwave_funding_intents
       set account_number = $3, bank_name = $4, status = 'pending',
           expires_at = $5, updated_at = now()
       where reference = $1 and customer_id = $2 and status = 'creating'
       returning reference, amount_kobo::text, account_number, bank_name, status, expires_at`,
      [input.reference, input.customerId, input.accountNumber, input.bankName, input.expiresAt],
    );
    const row = rows[0];
    if (!row) throw new Error("Funding intent could not be updated.");
    const transaction = await client.query(
      `update transactions set detail = $2, updated_at = now()
       where id = $1 and customer_id = $3 and status = 'pending'`,
      [input.reference, `Flutterwave virtual account ${input.accountNumber}`, input.customerId],
    );
    if ((transaction.rowCount ?? 0) !== 1) throw new Error("Funding transaction was not found.");
    await client.query("commit");
    return fundingIntentFromRow(row);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getRecentFundingIntents(customerId: string, limit = 3): Promise<FundingIntent[]> {
  const { rows } = await getPool().query<{
    reference: string;
    amount_kobo: string;
    account_number: string | null;
    bank_name: string | null;
    status: FundingIntent["status"];
    expires_at: Date | null;
  }>(
    `select reference, amount_kobo::text, account_number, bank_name, status, expires_at
     from flutterwave_funding_intents
     where customer_id = $1 and status in ('creating', 'pending', 'review')
     order by created_at desc limit $2`,
    [customerId, limit],
  );
  return rows.map(fundingIntentFromRow);
}

export async function applyFlutterwavePayment(input: {
  transactionId: string;
  reference: string;
  amountKobo: number;
}): Promise<"applied" | "duplicate" | "not_found" | "needs_review"> {
  assertAmount(input.amountKobo);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const priorPayment = await client.query<{ reference: string; amount_kobo: string }>(
      `select reference, amount_kobo::text from flutterwave_payments
       where transaction_id = $1`,
      [input.transactionId],
    );
    if (priorPayment.rows[0]) {
      if (
        priorPayment.rows[0].reference !== input.reference ||
        BigInt(priorPayment.rows[0].amount_kobo) !== BigInt(input.amountKobo)
      ) {
        throw new Error("Flutterwave transaction amount changed after it was credited.");
      }
      await client.query("commit");
      return "duplicate";
    }

    const intent = await client.query<{
      customer_id: string;
      amount_kobo: string;
    }>(
      `select customer_id, amount_kobo::text from flutterwave_funding_intents
       where reference = $1 and status = 'pending' for update`,
      [input.reference],
    );
    const account = intent.rows[0]
      ? null
      : await client.query<{ customer_id: string }>(
          `select customer_id from flutterwave_virtual_accounts
           where tx_ref = $1 and status = 'active'`,
          [input.reference],
        );
    const customerId = intent.rows[0]?.customer_id ?? account?.rows[0]?.customer_id;
    if (!customerId) {
      await client.query("rollback");
      return "not_found";
    }

    const policy = await getDepositPolicy(client, "flutterwave");
    const feeKobo = calculateDepositFeeKobo(input.amountKobo, policy);
    const reviewReason = depositReviewReason(
      input.amountKobo,
      intent.rows[0]?.amount_kobo ?? null,
      feeKobo,
      policy.minimumDepositKobo,
    );
    const historyId = intent.rows[0] ? input.reference : `flw-${input.transactionId}`;
    const detail = depositHistoryDetail(!!intent.rows[0], feeKobo);

    if (reviewReason) {
      await client.query(
        `insert into flutterwave_payments
           (transaction_id, reference, customer_id, amount_kobo, deposit_fee_kobo, review_required)
         values ($1, $2, $3, $4, $5, true)`,
        [input.transactionId, input.reference, customerId, input.amountKobo, feeKobo.toString()],
      );
      const history = await client.query(
        `insert into transactions
           (id, customer_id, service, title, detail, amount, direction, status, failure_reason)
         values ($1, $2, 'wallet', 'Wallet funding', $3, $4, 'credit', 'pending', $5)
         on conflict (id) do update
           set detail = excluded.detail, amount = excluded.amount, status = 'pending',
               failure_reason = excluded.failure_reason, updated_at = now()
         where transactions.customer_id = excluded.customer_id
           and transactions.direction = 'credit'
         returning id`,
        [historyId, customerId, detail, input.amountKobo / 100, reviewReason],
      );
      if (!history.rows[0]) throw new Error("Flutterwave review item conflicts with an existing transaction.");
      if (intent.rows[0]) {
        await client.query(
          `update flutterwave_funding_intents set status = 'review', updated_at = now()
           where reference = $1`,
          [input.reference],
        );
      }
      await client.query("commit");
      return "needs_review";
    }

    const netAmountKobo = BigInt(input.amountKobo) - feeKobo;
    await client.query(
      `insert into vtu_wallets (customer_id) values ($1)
       on conflict (customer_id) do nothing`,
      [customerId],
    );
    await client.query("select customer_id from vtu_wallets where customer_id = $1 for update", [customerId]);

    const reference = `flutterwave:${input.transactionId}`;
    const ledger = await client.query(
      `insert into vtu_wallet_ledger (reference, customer_id, direction, amount_kobo, source)
       values ($1, $2, 'credit', $3, 'flutterwave')
       on conflict (reference) do nothing
       returning reference`,
      [reference, customerId, netAmountKobo.toString()],
    );
    if ((ledger.rowCount ?? 0) !== 1) {
      throw new Error("Flutterwave payment conflicts with an existing wallet entry.");
    }
    await client.query(
      `update vtu_wallets set balance_kobo = balance_kobo + $2, updated_at = now()
       where customer_id = $1`,
      [customerId, netAmountKobo.toString()],
    );
    await client.query(
      `insert into flutterwave_payments
         (transaction_id, reference, customer_id, amount_kobo, deposit_fee_kobo, review_required)
       values ($1, $2, $3, $4, $5, false)`,
      [input.transactionId, input.reference, customerId, input.amountKobo, feeKobo.toString()],
    );
    const history = await client.query(
      `insert into transactions
         (id, customer_id, service, title, detail, amount, direction, status, failure_reason)
       values ($1, $2, 'wallet', 'Wallet funding', $3, $4, 'credit', 'success', null)
       on conflict (id) do update
         set detail = excluded.detail, amount = excluded.amount, status = 'success',
             failure_reason = null, updated_at = now()
       where transactions.customer_id = excluded.customer_id
         and transactions.direction = 'credit'
       returning id`,
      [historyId, customerId, detail, Number(netAmountKobo) / 100],
    );
    if (!history.rows[0]) throw new Error("Flutterwave payment conflicts with an existing transaction.");
    if (intent.rows[0]) {
      await client.query(
        `update flutterwave_funding_intents set status = 'completed', updated_at = now()
         where reference = $1`,
        [input.reference],
      );
      await client.query(
        `update transactions set status = 'success', updated_at = now()
         where id = $1 and customer_id = $2 and status = 'pending'`,
        [input.reference, customerId],
      );
    }
    await client.query("commit");
    return "applied";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function applyPaymentPointPayment(input: {
  transactionId: string;
  accountNumber: string;
  amountKobo: number;
}): Promise<"applied" | "duplicate" | "not_found" | "needs_review"> {
  assertAmount(input.amountKobo);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const priorPayment = await client.query<{
      customer_id: string;
      account_number: string;
      amount_kobo: string;
    }>(
      `select customer_id, account_number, amount_kobo::text
       from paymentpoint_payments where transaction_id = $1`,
      [input.transactionId],
    );
    if (priorPayment.rows[0]) {
      const prior = priorPayment.rows[0];
      if (
        prior.account_number !== input.accountNumber ||
        BigInt(prior.amount_kobo) !== BigInt(input.amountKobo)
      ) {
        throw new Error("PaymentPoint transaction details changed after it was credited.");
      }
      await client.query("commit");
      return "duplicate";
    }

    const intent = await client.query<{
      reference: string;
      customer_id: string;
      amount_kobo: string;
    }>(
      `select reference, customer_id, amount_kobo::text
       from paymentpoint_funding_intents
       where account_number = $1 and status = 'pending' for update`,
      [input.accountNumber],
    );
    const account = intent.rows[0]
      ? null
      : await client.query<{ customer_id: string }>(
          `select customer_id from paymentpoint_virtual_accounts
           where account_number = $1 and status = 'active' for update`,
          [input.accountNumber],
        );
    const customerId = intent.rows[0]?.customer_id ?? account?.rows[0]?.customer_id;
    if (!customerId) {
      const completedDuplicate = await client.query<{
        account_number: string;
        amount_kobo: string;
      }>(
        `select account_number, amount_kobo::text
         from paymentpoint_payments where transaction_id = $1`,
        [input.transactionId],
      );
      if (completedDuplicate.rows[0]) {
        const prior = completedDuplicate.rows[0];
        if (
          prior.account_number !== input.accountNumber ||
          BigInt(prior.amount_kobo) !== BigInt(input.amountKobo)
        ) {
          throw new Error("PaymentPoint transaction details changed after it was credited.");
        }
        await client.query("commit");
        return "duplicate";
      }
      await client.query("rollback");
      return "not_found";
    }
    const concurrentPayment = await client.query<{
      customer_id: string;
      account_number: string;
      amount_kobo: string;
    }>(
      `select customer_id, account_number, amount_kobo::text
       from paymentpoint_payments where transaction_id = $1`,
      [input.transactionId],
    );
    if (concurrentPayment.rows[0]) {
      const prior = concurrentPayment.rows[0];
      if (
        prior.customer_id !== customerId ||
        prior.account_number !== input.accountNumber ||
        BigInt(prior.amount_kobo) !== BigInt(input.amountKobo)
      ) {
        throw new Error("PaymentPoint transaction details changed after it was credited.");
      }
      await client.query("commit");
      return "duplicate";
    }

    const policy = await getDepositPolicy(client, "paymentpoint");
    const feeKobo = calculateDepositFeeKobo(input.amountKobo, policy);
    const reviewReason = depositReviewReason(
      input.amountKobo,
      intent.rows[0]?.amount_kobo ?? null,
      feeKobo,
      policy.minimumDepositKobo,
    );
    const historyId = intent.rows[0]?.reference ?? `pp-${input.transactionId}`;
    const detail = depositHistoryDetail(!!intent.rows[0], feeKobo);

    if (reviewReason) {
      await client.query(
        `insert into paymentpoint_payments
           (transaction_id, customer_id, account_number, amount_kobo, deposit_fee_kobo, review_required)
         values ($1, $2, $3, $4, $5, true)`,
        [input.transactionId, customerId, input.accountNumber, input.amountKobo, feeKobo.toString()],
      );
      const history = await client.query(
        `insert into transactions
           (id, customer_id, service, title, detail, amount, direction, status, failure_reason)
         values ($1, $2, 'wallet', 'Wallet funding', $3, $4, 'credit', 'pending', $5)
         on conflict (id) do update
           set detail = excluded.detail, amount = excluded.amount, status = 'pending',
               failure_reason = excluded.failure_reason, updated_at = now()
         where transactions.customer_id = excluded.customer_id
           and transactions.direction = 'credit'
         returning id`,
        [historyId, customerId, detail, input.amountKobo / 100, reviewReason],
      );
      if (!history.rows[0]) throw new Error("PaymentPoint review item conflicts with an existing transaction.");
      if (intent.rows[0]) {
        await client.query(
          `update paymentpoint_funding_intents set status = 'review', updated_at = now()
           where reference = $1 and status = 'pending'`,
          [intent.rows[0].reference],
        );
      }
      await client.query("commit");
      return "needs_review";
    }

    const netAmountKobo = BigInt(input.amountKobo) - feeKobo;
    await client.query(
      `insert into vtu_wallets (customer_id) values ($1)
       on conflict (customer_id) do nothing`,
      [customerId],
    );
    await client.query("select customer_id from vtu_wallets where customer_id = $1 for update", [customerId]);

    const reference = `paymentpoint:${input.transactionId}`;
    const ledger = await client.query(
      `insert into vtu_wallet_ledger (reference, customer_id, direction, amount_kobo, source)
       values ($1, $2, 'credit', $3, 'paymentpoint')
       on conflict (reference) do nothing
       returning reference`,
      [reference, customerId, netAmountKobo.toString()],
    );
    if ((ledger.rowCount ?? 0) !== 1) {
      throw new Error("PaymentPoint payment conflicts with an existing wallet entry.");
    }
    await client.query(
      `update vtu_wallets set balance_kobo = balance_kobo + $2, updated_at = now()
       where customer_id = $1`,
      [customerId, netAmountKobo.toString()],
    );
    await client.query(
      `insert into paymentpoint_payments
         (transaction_id, customer_id, account_number, amount_kobo, deposit_fee_kobo, review_required)
       values ($1, $2, $3, $4, $5, false)`,
      [input.transactionId, customerId, input.accountNumber, input.amountKobo, feeKobo.toString()],
    );
    const history = await client.query(
      `insert into transactions
         (id, customer_id, service, title, detail, amount, direction, status, failure_reason)
       values ($1, $2, 'wallet', 'Wallet funding', $3, $4, 'credit', 'success', null)
       on conflict (id) do update
         set detail = excluded.detail, amount = excluded.amount,
             status = 'success', failure_reason = null, updated_at = now()
       where transactions.customer_id = excluded.customer_id
         and transactions.direction = 'credit'
       returning id`,
      [historyId, customerId, detail, Number(netAmountKobo) / 100],
    );
    if (!history.rows[0]) throw new Error("PaymentPoint payment conflicts with an existing transaction.");
    if (intent.rows[0]) {
      await client.query(
        `update paymentpoint_funding_intents set status = 'completed', updated_at = now()
         where reference = $1 and status = 'pending'`,
        [intent.rows[0].reference],
      );
    }
    await client.query("commit");
    return "applied";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
