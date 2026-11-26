import "server-only";
import { getPool } from "@/lib/db";

export type NotifyTarget = { email: string | null; phone: string | null };

export async function getNotifyTarget(customerId: string): Promise<NotifyTarget | null> {
  const { rows } = await getPool().query<NotifyTarget>(
    "select email, phone from customers where id = $1",
    [customerId],
  );
  return rows[0] ?? null;
}

/** True only if this notification id was new. */
export async function insertNotificationOnce(notification: {
  id: string;
  customerId: string;
  title: string;
  body: string;
}): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `insert into vtu_notifications (id, customer_id, title, body) values ($1, $2, $3, $4)
     on conflict (id) do nothing`,
    [notification.id, notification.customerId, notification.title, notification.body],
  );
  return (rowCount ?? 0) > 0;
}
