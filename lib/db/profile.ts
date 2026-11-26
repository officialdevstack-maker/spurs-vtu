import "server-only";
import { getPool } from "@/lib/db";
import { DEFAULT_SETTINGS, type ProfileSettings, type Theme } from "@/lib/profile";

type Row = {
  notify_email: boolean;
  notify_sms: boolean;
  notify_push: boolean;
  notify_transactions: boolean;
  notify_promotions: boolean;
  login_alerts: boolean;
  use_cashback_default: boolean;
  confirm_purchases: boolean;
  theme: Theme;
};

export async function getProfileSettings(customerId: string): Promise<ProfileSettings> {
  const { rows } = await getPool().query<Row>(
    `select notify_email, notify_sms, notify_push, notify_transactions, notify_promotions,
            login_alerts, use_cashback_default, confirm_purchases, theme
     from customer_settings where customer_id = $1`,
    [customerId],
  );
  const row = rows[0];
  return row
    ? {
        notifyEmail: row.notify_email,
        notifySms: row.notify_sms,
        notifyPush: row.notify_push,
        notifyTransactions: row.notify_transactions,
        notifyPromotions: row.notify_promotions,
        loginAlerts: row.login_alerts,
        useCashbackDefault: row.use_cashback_default,
        confirmPurchases: row.confirm_purchases,
        theme: row.theme,
      }
    : DEFAULT_SETTINGS;
}

export async function saveProfile(customerId: string, phone: string | null, settings: ProfileSettings): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("update customers set phone = $2 where id = $1", [customerId, phone]);
    await client.query(
      `insert into customer_settings
         (customer_id, notify_email, notify_sms, notify_push, notify_transactions, notify_promotions,
          login_alerts, use_cashback_default, confirm_purchases, theme)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (customer_id) do update set
         notify_email = excluded.notify_email,
         notify_sms = excluded.notify_sms,
         notify_push = excluded.notify_push,
         notify_transactions = excluded.notify_transactions,
         notify_promotions = excluded.notify_promotions,
         login_alerts = excluded.login_alerts,
         use_cashback_default = excluded.use_cashback_default,
         confirm_purchases = excluded.confirm_purchases,
         theme = excluded.theme,
         updated_at = now()`,
      [
        customerId,
        settings.notifyEmail,
        settings.notifySms,
        settings.notifyPush,
        settings.notifyTransactions,
        settings.notifyPromotions,
        settings.loginAlerts,
        settings.useCashbackDefault,
        settings.confirmPurchases,
        settings.theme,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
