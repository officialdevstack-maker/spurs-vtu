"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Tabs } from "@/components/admin/tabs";
import { btnIcon, btnPrimary } from "@/components/admin/modal";
import { ConfirmDialog } from "@/components/admin/airtime-data/dialogs";
import { PERMISSIONS } from "@/lib/admin/permissions";
import { editRoleUrl, newRoleUrl, type Role, type StaffMember } from "@/lib/admin/roles";
import {
  addStaff,
  changeStaffRole,
  removeRole,
  removeStaff,
} from "@/app/admin/users/roles/actions";
import { AddStaffDialog, ChangeRoleDialog } from "./staff-dialogs";

type Tab = "roles" | "staff";
type Dialog =
  | { kind: "add-staff" }
  | { kind: "change-role"; member: StaffMember }
  | { kind: "remove-staff"; member: StaffMember }
  | { kind: "delete-role"; role: Role }
  | null;

const TABS = [
  { id: "roles", label: "Roles" },
  { id: "staff", label: "Staff" },
];
const th = "px-3 py-3 text-left text-sm font-medium text-gray-600 dark:text-[#9FB3B7] sm:px-5";
const td = "px-3 py-4 sm:px-5";

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
      <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{text}</p>
    </div>
  );
}

export function RolesManager({
  roles,
  staff,
  initialTab,
}: {
  roles: Role[];
  staff: StaffMember[];
  initialTab: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <Tabs label="User management" tabs={TABS} value={tab} onChange={(id) => setTab(id as Tab)}>
      {tab === "roles" ? (
        <section aria-labelledby="roles-heading">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="roles-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">Roles</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
                A role is a set of permissions. Assign one to each staff member.
              </p>
            </div>
            <Link href={newRoleUrl} className={`${btnPrimary} inline-flex shrink-0 items-center gap-2`}>
              <Plus className="size-5" aria-hidden="true" />
              Add role
            </Link>
          </div>
          {roles.length === 0 ? (
            <Empty title="No roles yet" text="Add a role like Support or Finance, then choose what it can do." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th scope="col" className={th}>Role</th>
                    <th scope="col" className={`${th} text-right`}>Permissions</th>
                    <th scope="col" className={`${th} text-right`}>Staff</th>
                    <th scope="col" className={`${th} text-right`}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td className={td}>
                        <p className="font-medium">{role.name}</p>
                        {role.description ? <p className="text-gray-600 dark:text-[#9FB3B7]">{role.description}</p> : null}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{role.permissions.length} of {PERMISSIONS.length}</td>
                      <td className={`${td} text-right tabular-nums`}>{role.members}</td>
                      <td className={td}>
                        <div className="flex items-center justify-end gap-1">
                          <Link href={editRoleUrl(role.id)} aria-label={`Edit ${role.name}`} title="Edit" className={btnIcon}>
                            <Pencil className="size-4" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "delete-role", role })}
                            aria-label={`Delete ${role.name}`}
                            title="Delete"
                            className={btnIcon}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="staff-heading">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="staff-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">Staff</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
                People who can open the admin area. Owners set in <code>ADMIN_SPURS_IDS</code> always have full access and aren&apos;t listed here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDialog({ kind: "add-staff" })}
              disabled={roles.length === 0}
              className={`${btnPrimary} inline-flex shrink-0 items-center gap-2`}
            >
              <Plus className="size-5" aria-hidden="true" />
              Add staff
            </button>
          </div>
          {roles.length === 0 ? (
            <p className="mb-4 text-sm text-gray-600 dark:text-[#9FB3B7]">Add a role first, then you can add staff.</p>
          ) : null}
          {staff.length === 0 ? (
            <Empty title="No staff yet" text="Add a customer as staff and give them a role." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th scope="col" className={th}>Member</th>
                    <th scope="col" className={th}>Role</th>
                    <th scope="col" className={`${th} text-right`}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {staff.map((member) => {
                    const displayName = member.name || member.username || "Unnamed";
                    return (
                      <tr key={member.id}>
                        <td className={td}>
                          <p className="font-medium">{displayName}</p>
                          <p className="text-gray-600 dark:text-[#9FB3B7]">
                            {member.username ? `@${member.username}` : member.email ?? "No email"}
                          </p>
                        </td>
                        <td className={td}>
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold dark:bg-white/10">{member.roleName}</span>
                        </td>
                        <td className={td}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "change-role", member })}
                              aria-label={`Change role for ${displayName}`}
                              title="Change role"
                              className={btnIcon}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "remove-staff", member })}
                              aria-label={`Remove ${displayName}`}
                              title="Remove"
                              className={btnIcon}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {dialog?.kind === "add-staff" ? (
        <AddStaffDialog
          roles={roles}
          onClose={close}
          onSubmit={async (identifier, roleId) => {
            const result = await addStaff(identifier, roleId);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
      {dialog?.kind === "change-role" ? (
        <ChangeRoleDialog
          member={dialog.member}
          roles={roles}
          onClose={close}
          onSubmit={async (roleId) => {
            const result = await changeStaffRole(dialog.member.id, roleId);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
      {dialog?.kind === "remove-staff" ? (
        <ConfirmDialog
          title={`Remove ${dialog.member.name || dialog.member.username || "this person"}?`}
          text="They will lose access to the admin area. Their customer account is not affected."
          confirmLabel="Remove"
          onClose={close}
          onConfirm={async () => {
            const result = await removeStaff(dialog.member.id);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
      {dialog?.kind === "delete-role" ? (
        <ConfirmDialog
          title={`Delete ${dialog.role.name}?`}
          text={
            dialog.role.members > 0
              ? `${dialog.role.members} staff still have this role. Move them to another role before deleting it.`
              : `This permanently removes the ${dialog.role.name} role.`
          }
          confirmLabel="Delete role"
          onClose={close}
          onConfirm={async () => {
            const result = await removeRole(dialog.role.id);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </Tabs>
  );
}
