import "server-only";
import { getPool } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export type PaymentProviderSettings = {
  id: "flutterwave";
  name: string;
  enabled: boolean;
  hasPublicKey: boolean;
  hasSecretKey: boolean;
  hasWebhookHash: boolean;
};

export type PaymentPointProviderSettings = {
  id: "paymentpoint";
  name: string;
  enabled: boolean;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasBusinessId: boolean;
  hasWebhookSecret: boolean;
};

export type FlutterwaveCredentials = {
  publicKey: string;
  secretKey: string;
  webhookHash: string;
};

export type PaymentPointCredentials = {
  apiKey: string;
  apiSecret: string;
  businessId: string;
  webhookSecret: string;
};

export async function getPaymentProviderSettings(): Promise<PaymentProviderSettings | null> {
  const { rows } = await getPool().query<{
    id: "flutterwave";
    name: string;
    enabled: boolean;
    has_public_key: boolean;
    has_secret_key: boolean;
    has_webhook_hash: boolean;
  }>(
    `select id, name, enabled,
            public_key_enc is not null as has_public_key,
            secret_key_enc is not null as has_secret_key,
            webhook_hash_enc is not null as has_webhook_hash
     from payment_providers where id = 'flutterwave'`,
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        enabled: row.enabled,
        hasPublicKey: row.has_public_key,
        hasSecretKey: row.has_secret_key,
        hasWebhookHash: row.has_webhook_hash,
      }
    : null;
}

export async function getFlutterwaveCredentials(includeDisabled = false): Promise<FlutterwaveCredentials | null> {
  const { rows } = await getPool().query<{
    public_key_enc: string;
    secret_key_enc: string;
    webhook_hash_enc: string;
  }>(
    `select public_key_enc, secret_key_enc, webhook_hash_enc
     from payment_providers
     where id = 'flutterwave' and ($1::boolean or enabled)`,
    [includeDisabled],
  );
  const row = rows[0];
  return row
    ? {
        publicKey: decryptSecret(row.public_key_enc),
        secretKey: decryptSecret(row.secret_key_enc),
        webhookHash: decryptSecret(row.webhook_hash_enc),
      }
    : null;
}

export async function getPaymentPointProviderSettings(): Promise<PaymentPointProviderSettings | null> {
  const { rows } = await getPool().query<{
    id: "paymentpoint";
    name: string;
    enabled: boolean;
    has_api_key: boolean;
    has_api_secret: boolean;
    has_business_id: boolean;
    has_webhook_secret: boolean;
  }>(
    `select id, name, enabled,
            public_key_enc is not null as has_api_key,
            secret_key_enc is not null as has_api_secret,
            business_id_enc is not null as has_business_id,
            webhook_hash_enc is not null as has_webhook_secret
     from payment_providers where id = 'paymentpoint'`,
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        enabled: row.enabled,
        hasApiKey: row.has_api_key,
        hasApiSecret: row.has_api_secret,
        hasBusinessId: row.has_business_id,
        hasWebhookSecret: row.has_webhook_secret,
      }
    : null;
}

export async function getPaymentPointCredentials(includeDisabled = false): Promise<PaymentPointCredentials | null> {
  const { rows } = await getPool().query<{
    public_key_enc: string;
    secret_key_enc: string;
    business_id_enc: string;
    webhook_hash_enc: string;
  }>(
    `select public_key_enc, secret_key_enc, business_id_enc, webhook_hash_enc
     from payment_providers
     where id = 'paymentpoint' and ($1::boolean or enabled)`,
    [includeDisabled],
  );
  const row = rows[0];
  return row
    ? {
        apiKey: decryptSecret(row.public_key_enc),
        apiSecret: decryptSecret(row.secret_key_enc),
        businessId: decryptSecret(row.business_id_enc),
        webhookSecret: decryptSecret(row.webhook_hash_enc),
      }
    : null;
}

export async function saveFlutterwaveProvider(input: {
  publicKey: string;
  secretKey: string;
  webhookHash: string;
  enabled: boolean;
}): Promise<boolean> {
  const publicKey = input.publicKey ? encryptSecret(input.publicKey) : null;
  const secretKey = input.secretKey ? encryptSecret(input.secretKey) : null;
  const webhookHash = input.webhookHash ? encryptSecret(input.webhookHash) : null;
  const { rowCount } = await getPool().query(
    `insert into payment_providers
       (id, name, public_key_enc, secret_key_enc, webhook_hash_enc, enabled)
     values ('flutterwave', 'Flutterwave', $1, $2, $3, $4)
     on conflict (id) do update
       set public_key_enc = coalesce($1, payment_providers.public_key_enc),
           secret_key_enc = coalesce($2, payment_providers.secret_key_enc),
           webhook_hash_enc = coalesce($3, payment_providers.webhook_hash_enc),
           enabled = $4, updated_at = now()`,
    [publicKey, secretKey, webhookHash, input.enabled],
  );
  return (rowCount ?? 0) > 0;
}

export async function savePaymentPointProvider(input: {
  apiKey: string;
  apiSecret: string;
  businessId: string;
  webhookSecret: string;
  enabled: boolean;
}): Promise<boolean> {
  const apiKey = input.apiKey ? encryptSecret(input.apiKey) : null;
  const apiSecret = input.apiSecret ? encryptSecret(input.apiSecret) : null;
  const businessId = input.businessId ? encryptSecret(input.businessId) : null;
  const webhookSecret = input.webhookSecret ? encryptSecret(input.webhookSecret) : null;
  const { rowCount } = await getPool().query(
    `insert into payment_providers
       (id, name, public_key_enc, secret_key_enc, business_id_enc, webhook_hash_enc, enabled)
     values ('paymentpoint', 'PaymentPoint', $1, $2, $3, $4, $5)
     on conflict (id) do update
       set public_key_enc = coalesce($1, payment_providers.public_key_enc),
           secret_key_enc = coalesce($2, payment_providers.secret_key_enc),
           business_id_enc = coalesce($3, payment_providers.business_id_enc),
           webhook_hash_enc = coalesce($4, payment_providers.webhook_hash_enc),
           enabled = $5, updated_at = now()`,
    [apiKey, apiSecret, businessId, webhookSecret, input.enabled],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteFlutterwaveProvider(): Promise<"deleted" | "not_found" | "in_use"> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const current = await client.query("select id from payment_providers where id = 'flutterwave' for update");
    if (!current.rowCount) {
      await client.query("rollback");
      return "not_found";
    }

    const references = await client.query(
      `select exists(select 1 from flutterwave_virtual_accounts)
           or exists(select 1 from flutterwave_funding_intents where status in ('creating', 'pending'))
           or exists(select 1 from flutterwave_payments) as in_use`,
    );
    if (references.rows[0]?.in_use) {
      await client.query("rollback");
      return "in_use";
    }
    await client.query("delete from payment_providers where id = 'flutterwave'");
    await client.query("commit");
    return "deleted";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePaymentPointProvider(): Promise<"deleted" | "not_found" | "in_use"> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const current = await client.query("select id from payment_providers where id = 'paymentpoint' for update");
    if (!current.rowCount) {
      await client.query("rollback");
      return "not_found";
    }

    const references = await client.query(
      `select exists(select 1 from paymentpoint_virtual_accounts)
           or exists(select 1 from paymentpoint_payments) as in_use`,
    );
    if (references.rows[0]?.in_use) {
      await client.query("rollback");
      return "in_use";
    }
    await client.query("delete from payment_providers where id = 'paymentpoint'");
    await client.query("commit");
    return "deleted";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
