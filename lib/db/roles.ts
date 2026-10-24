import "server-only";
import { getPool } from "@/lib/db";
import { isPermission, type Permission } from "@/lib/admin/permissions";
import type { Role, StaffMember } from "@/lib/admin/roles";

export type RoleFields = { name: string; description: string; permissions: Permission[] };

const dbFail = (code: "NO_CUSTOMER" | "ALREADY_STAFF") => Object.assign(new Error(code), { code });
const changed = (result: { rowCount: number | null }) => (result.rowCount ?? 0) > 0;

export async function listRoles(): Promise<Role[]> {
  const pool = getPool();
  const [roles, perms, members] = await Promise.all([
    pool.query<{ id: string; name: string; description: string }>(
      "select id, name, description from roles order by name",
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
    const result = await client.query("update roles set name = $2, description = $3 where id = $1", [
      id,
      role.name,
      role.description,
    ]);
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
  return changed(await getPool().query("delete from roles where id = $1", [id]));
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
    `select s.id, s.name, s.username, s.email, s.role_id, r.name as role_name
       from staff_members s
       join roles r on r.id = s.role_id
      order by s.created_at desc, s.id`,
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
  const { rows } = await pool.query<{
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
  }>(
    `select id, name, username, email
       from customers
      where lower(username) = $1 or lower(email) = $1 or phone = $2 or id = $2
      limit 1`,
    [key, typed],
  );
  const customer = rows[0];
  if (!customer) throw dbFail("NO_CUSTOMER");

  const result = await pool.query(
    `insert into staff_members (id, name, username, email, role_id)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do nothing`,
    [customer.id, customer.name ?? "", customer.username, customer.email, roleId],
  );
  if (!changed(result)) throw dbFail("ALREADY_STAFF");
  return true;
}

export async function setStaffRole(id: string, roleId: string): Promise<boolean> {
  return changed(await getPool().query("update staff_members set role_id = $2 where id = $1", [id, roleId]));
}

export async function deleteStaff(id: string): Promise<boolean> {
  return changed(await getPool().query("delete from staff_members where id = $1", [id]));
}

export async function getStaffPermissions(spursId: string): Promise<Permission[] | null> {
  const { rows } = await getPool().query<{ permission: string | null }>(
    `select rp.permission
       from staff_members s
       left join role_permissions rp on rp.role_id = s.role_id
      where s.id = $1`,
    [spursId],
  );
  if (rows.length === 0) return null;
  return rows.map((row) => row.permission).filter(isPermission);
}
