import "server-only";
import { getPool } from "@/lib/db";
import { isPermission, type Permission } from "@/lib/admin/permissions";
import type { Role, StaffMember } from "@/lib/admin/roles";

export type RoleFields = { name: string; description: string; permissions: Permission[] };

const dbFail = (code: "NO_CUSTOMER" | "ALREADY_STAFF" | "BAD_ROLE") =>
  Object.assign(new Error(code), { code });
const changed = (result: { rowCount: number | null }) => (result.rowCount ?? 0) > 0;

export async function listRoles(): Promise<Role[]> {
  const pool = getPool();
  const [roles, perms, members] = await Promise.all([
    pool.query<{ id: string; name: string; description: string }>(
      "select id, name, description from roles where not is_owner order by name",
    ),
    pool.query<{ role_id: string; permission: string }>("select role_id, permission from role_permissions"),
    pool.query<{ role_id: string; n: string }>("select role_id, count(*) as n from staff_members group by role_id"),
  ]);

  const byRole = new Map<string, Permission[]>();
  for (const row of perms.rows) {
    if (!isPermission(row.permission)) continue;
    const list = byRole.get(row.role_id) ?? [];
    list.push(row.permission);
    byRole.set(row.role_id, list);
  }
  const counts = new Map(members.rows.map((row) => [row.role_id, Number(row.n)]));

  return roles.rows.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: byRole.get(role.id) ?? [],
    members: counts.get(role.id) ?? 0,
  }));
}

export async function getRole(id: string): Promise<Role | null> {
  return (await listRoles()).find((role) => role.id === id) ?? null;
}

export async function createRole(id: string, role: RoleFields): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("insert into roles (id, name, description) values ($1, $2, $3)", [
      id,
      role.name,
      role.description,
    ]);
    if (role.permissions.length > 0) {
      await client.query("insert into role_permissions (role_id, permission) select $1, unnest($2::text[])", [
        id,
        role.permissions,
      ]);
    }
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRole(id: string, role: RoleFields): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query(
      "update roles set name = $2, description = $3 where id = $1 and not is_owner",
      [id, role.name, role.description],
    );
    if (!changed(result)) {
      await client.query("rollback");
      return false;
    }
    await client.query("delete from role_permissions where role_id = $1", [id]);
    if (role.permissions.length > 0) {
      await client.query("insert into role_permissions (role_id, permission) select $1, unnest($2::text[])", [
        id,
        role.permissions,
      ]);
    }
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRole(id: string): Promise<boolean> {
  return changed(await getPool().query("delete from roles where id = $1 and not is_owner", [id]));
}

export async function listStaff(): Promise<StaffMember[]> {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    username: string | null;
    email: string | null;
    role_id: string;
    role_name: string;
  }>(
    `select s.customer_id as id, coalesce(c.name, '') as name, c.username, c.email,
            s.role_id, r.name as role_name
       from staff_members s
       join customers c on c.id = s.customer_id
       join roles r on r.id = s.role_id
      where not r.is_owner
      order by s.created_at desc, s.customer_id`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    roleId: row.role_id,
    roleName: row.role_name,
  }));
}

export async function addStaff(identifier: string, roleId: string): Promise<boolean> {
  const pool = getPool();
  const typed = identifier.trim();
  const key = typed.replace(/^@/, "").toLowerCase();

  const role = await pool.query("select 1 from roles where id = $1 and not is_owner", [roleId]);
  if (!role.rowCount) throw dbFail("BAD_ROLE");

  const { rows } = await pool.query<{ id: string }>(
    `select c.id
       from customers c
      where lower(c.username) = $1 or lower(c.email) = $1 or c.phone = $2 or c.id = $2
      limit 1`,
    [key, typed],
  );
  const customer = rows[0];
  if (!customer) throw dbFail("NO_CUSTOMER");

  const result = await pool.query(
    `insert into staff_members (customer_id, role_id) values ($1, $2)
     on conflict (customer_id) do nothing`,
    [customer.id, roleId],
  );
  if (!changed(result)) throw dbFail("ALREADY_STAFF");
  return true;
}

export async function setStaffRole(id: string, roleId: string): Promise<boolean> {
  return changed(
    await getPool().query(
      `update staff_members s set role_id = $2
        where s.customer_id = $1
          and exists (select 1 from roles r where r.id = $2 and not r.is_owner)
          and exists (select 1 from roles r where r.id = s.role_id and not r.is_owner)`,
      [id, roleId],
    ),
  );
}

export async function deleteStaff(id: string): Promise<boolean> {
  return changed(
    await getPool().query(
      `delete from staff_members s using roles r
        where s.customer_id = $1 and r.id = s.role_id and not r.is_owner`,
      [id],
    ),
  );
}

export async function isStaffMember(customerId: string): Promise<boolean> {
  const { rowCount } = await getPool().query("select 1 from staff_members where customer_id = $1", [customerId]);
  return (rowCount ?? 0) > 0;
}

export async function getStaffAccess(
  customerId: string,
): Promise<{ owner: boolean; permissions: Permission[] } | null> {
  const { rows } = await getPool().query<{ is_owner: boolean; permission: string | null }>(
    `select r.is_owner, rp.permission
       from staff_members s
       join roles r on r.id = s.role_id
       join customers c on c.id = s.customer_id and c.status = 'active'
       left join role_permissions rp on rp.role_id = s.role_id
      where s.customer_id = $1`,
    [customerId],
  );
  if (rows.length === 0) return null;
  return {
    owner: rows[0].is_owner,
    permissions: rows.map((row) => row.permission).filter(isPermission),
  };
}
