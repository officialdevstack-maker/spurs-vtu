import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import {
  MAX_MESSAGES, MAX_OPEN,
  type ThreadMessage, type TicketDetail, type TicketRow, type TicketStatus,
} from "@/lib/admin/support";

const dbFail = (code: "TOO_MANY" | "BAD_TRANSACTION" | "CLOSED" | "TOO_LONG" | "NOT_FOUND") =>
  Object.assign(new Error(code), { code });

export async function createTicket(t: { customerId: string; subject: string; body: string; transactionId: string | null }) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select 1 from customers where id = $1 for update", [t.customerId]);
    const open = await client.query<{ n: string }>(
      "select count(*)::text as n from support_tickets where customer_id = $1 and status <> 'closed'",
      [t.customerId],
    );
    if (Number(open.rows[0].n) >= MAX_OPEN) throw dbFail("TOO_MANY");
    if (t.transactionId) {
      const own = await client.query("select 1 from transactions where id = $1 and customer_id = $2", [t.transactionId, t.customerId]);
      if (!own.rowCount) throw dbFail("BAD_TRANSACTION");
    }
    const ticketId = randomUUID();
    const messageId = randomUUID();
    await client.query(
      "insert into support_tickets (id, customer_id, subject, transaction_id) values ($1, $2, $3, $4)",
      [ticketId, t.customerId, t.subject, t.transactionId],
    );
    await client.query(
      "insert into support_messages (id, ticket_id, author_id, from_staff, body) values ($1, $2, $3, false, $4)",
      [messageId, ticketId, t.customerId, t.body],
    );
    await client.query("commit");
    return { ticketId, messageId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function addMessage(m: { ticketId: string; authorId: string; fromStaff: boolean; body: string }) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query<{ customer_id: string; status: TicketStatus; subject: string; n: string }>(
      `select customer_id, status, subject,
              (select count(*) from support_messages where ticket_id = $1)::text as n
       from support_tickets where id = $1 for update`,
      [m.ticketId],
    );
    const ticket = found.rows[0];
    if (!ticket || (!m.fromStaff && ticket.customer_id !== m.authorId)) throw dbFail("NOT_FOUND");
    if (!m.fromStaff && ticket.status === "closed") throw dbFail("CLOSED");
    if (Number(ticket.n) >= MAX_MESSAGES) throw dbFail("TOO_LONG");

    const messageId = randomUUID();
    await client.query(
      "insert into support_messages (id, ticket_id, author_id, from_staff, body) values ($1, $2, $3, $4, $5)",
      [messageId, m.ticketId, m.authorId, m.fromStaff, m.body],
    );
    await client.query(
      "update support_tickets set status = $2, last_message_at = now(), updated_at = now() where id = $1",
      [m.ticketId, m.fromStaff ? "answered" : "open"],
    );
    await client.query("commit");
    return { messageId, customerId: ticket.customer_id, subject: ticket.subject, previous: ticket.status };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setTicketStatus(id: string, status: TicketStatus, customerId: string | null) {
  const { rowCount } = await getPool().query(
    `update support_tickets set status = $2, updated_at = now()
     where id = $1 and status <> $2 and ($3::text is null or customer_id = $3)`,
    [id, status, customerId],
  );
  return (rowCount ?? 0) > 0;
}

type ListRow = { id: string; subject: string; status: TicketStatus; username: string | null; name: string | null; messages: string; last_message_at: Date };
const toRow = (r: ListRow): TicketRow => ({
  id: r.id, subject: r.subject, status: r.status,
  customer: r.username ? `@${r.username}` : (r.name ?? "unknown"),
  messages: Number(r.messages), at: r.last_message_at.toISOString(),
});
const LIST = `select t.id, t.subject, t.status, c.username, c.name, t.last_message_at,
       (select count(*) from support_messages m where m.ticket_id = t.id)::text as messages
     from support_tickets t join customers c on c.id = t.customer_id`;

export async function listCustomerTickets(customerId: string, limit = 50): Promise<TicketRow[]> {
  const { rows } = await getPool().query<ListRow>(
    `${LIST} where t.customer_id = $1 order by t.last_message_at desc limit $2`,
    [customerId, limit],
  );
  return rows.map(toRow);
}

export async function listAdminTickets(f: { status: TicketStatus | "all"; query: string; page: number; pageSize: number }) {
  const pool = getPool();
  const escaped = f.query.trim().replace(/[!%_]/g, "!$&");
  const search = escaped ? `%${escaped}%` : null;
  const params = [f.status === "all" ? null : f.status, search];
  const where = `where ($1::text is null or t.status = $1)
      and ($2::text is null or t.subject ilike $2 escape '!' or c.username ilike $2 escape '!' or c.email ilike $2 escape '!')`;

  const count = await pool.query<{ n: string }>(
    `select count(*)::text as n from support_tickets t join customers c on c.id = t.customer_id ${where}`, params);
  const total = Number(count.rows[0]?.n ?? 0);
  const pageSize = Math.max(1, Math.min(f.pageSize, 100));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, f.page), pageCount);

  const { rows } = await pool.query<ListRow>(
    `${LIST} ${where}
     order by (t.status = 'open') desc,
              case when t.status = 'open' then t.last_message_at end asc,
              t.last_message_at desc
     limit $3 offset $4`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { items: rows.map(toRow), total, page };
}

export async function getTicket(id: string, customerId: string | null): Promise<TicketDetail | null> {
  const pool = getPool();
  const head = await pool.query<{
    id: string; subject: string; status: TicketStatus; created_at: Date; customer_id: string;
    username: string | null; name: string | null; email: string | null; phone: string | null;
    tx_id: string | null; tx_title: string | null; tx_amount: string | null; tx_status: string | null;
  }>(
    `select t.id, t.subject, t.status, t.created_at, c.id as customer_id, c.username, c.name, c.email, c.phone,
            x.id as tx_id, x.title as tx_title, x.amount as tx_amount, x.status as tx_status
     from support_tickets t
     join customers c on c.id = t.customer_id
     left join transactions x on x.id = t.transaction_id
     where t.id = $1 and ($2::text is null or t.customer_id = $2)`,
    [id, customerId],
  );
  const t = head.rows[0];
  if (!t) return null;

  const msgs = await pool.query<{ id: string; from_staff: boolean; body: string; created_at: Date; username: string | null; name: string | null }>(
    `select m.id, m.from_staff, m.body, m.created_at, a.username, a.name
     from support_messages m left join customers a on a.id = m.author_id
     where m.ticket_id = $1 order by m.created_at, m.id`,
    [id],
  );
  const forCustomer = customerId !== null;
  const who = (username: string | null, name: string | null) => (username ? `@${username}` : (name ?? "Unknown"));
  const messages: ThreadMessage[] = msgs.rows.map((m) => ({
    id: m.id,
    fromStaff: m.from_staff,
    author: forCustomer ? (m.from_staff ? "Spur VTU support" : "You") : who(m.username, m.name),
    body: m.body,
    at: m.created_at.toISOString(),
  }));

  return {
    id: t.id, subject: t.subject, status: t.status, createdAt: t.created_at.toISOString(),
    customer: { id: t.customer_id, label: who(t.username, t.name), email: t.email, phone: t.phone },
    transaction: t.tx_id ? { id: t.tx_id, title: t.tx_title ?? "", amount: Number(t.tx_amount ?? 0), status: t.tx_status ?? "" } : null,
    messages,
  };
}

export async function countOpenTickets(): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>("select count(*)::text as n from support_tickets where status = 'open'");
  return Number(rows[0]?.n ?? 0);
}

export async function listSupportRecipients(): Promise<string[]> {
  const { rows } = await getPool().query<{ id: string }>(
    `select distinct c.id
     from staff_members s
     join roles r on r.id = s.role_id
     join customers c on c.id = s.customer_id and c.status = 'active'
     where r.is_owner
        or exists (select 1 from role_permissions rp where rp.role_id = r.id and rp.permission = 'support.manage')`,
  );
  return rows.map((r) => r.id);
}
