"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import { PERMISSION_GROUPS, type Permission } from "@/lib/admin/permissions";
import { rolesUrl, type Role } from "@/lib/admin/roles";
import { createRole, updateRole } from "@/app/admin/users/roles/actions";

type Errors = Partial<Record<"name" | "permissions" | "form", string>>;

export function RoleForm({ role }: { role?: Role }) {
  const router = useRouter();
  const base = useId();
  const back = rolesUrl("roles");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Permission[]>(role?.permissions ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  function toggle(id: Permission) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setErrors((previous) => ({ ...previous, permissions: undefined }));
  }

  function toggleGroup(ids: Permission[], allOn: boolean) {
    setSelected((current) => {
      const remaining = current.filter((item) => !ids.includes(item));
      return allOn ? remaining : [...remaining, ...ids];
    });
    setErrors((previous) => ({ ...previous, permissions: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter a role name.";
    if (selected.length === 0) next.permissions = "Choose at least one permission.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = { name, description, permissions: selected };
    startTransition(async () => {
      try {
        const result = role ? await updateRole(role.id, input) : await createRole(input);
        if (!result.ok) {
          setErrors({ form: result.error });
          return;
        }
        toast.success(role ? "Role updated" : "Role created");
        router.push(back);
        router.refresh();
      } catch (error) {
        console.error("[roles] Failed to save role", error);
        setErrors({ form: "Could not save the role. Please try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-5 rounded-2xl border border-gray-200 bg-gray-100 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6">
      {errors.form ? <FormError>{errors.form}</FormError> : null}
      <Field id={`${base}-name`} label="Role name" error={errors.name}>
        <input
          id={`${base}-name`}
          autoFocus={!role}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="Support"
          aria-invalid={Boolean(errors.name)}
          className={inputClass(Boolean(errors.name))}
        />
      </Field>
      <Field id={`${base}-description`} label="Description" hint="Optional. What this role is for.">
        <input
          id={`${base}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={160}
          className={inputClass()}
        />
      </Field>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Permissions</p>
          {errors.permissions ? (
            <p role="alert" className="mt-1 text-sm text-[#C8432B]">{errors.permissions}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
              Everyone with a role can open the admin overview. Choose what else this role can do.
            </p>
          )}
        </div>
        {PERMISSION_GROUPS.map((group) => {
          const ids = group.permissions.map(({ id }) => id);
          const allOn = ids.every((id) => selected.includes(id));
          return (
            <fieldset key={group.id} className="rounded-xl border border-gray-200 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <legend className="text-sm font-semibold">{group.label}</legend>
                <button
                  type="button"
                  onClick={() => toggleGroup(ids, allOn)}
                  className="rounded text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]"
                >
                  {allOn ? "Clear" : "Select all"}
                </button>
              </div>
              <ul className="mt-3 space-y-3">
                {group.permissions.map((permission) => (
                  <li key={permission.id}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(permission.id)}
                        onChange={() => toggle(permission.id)}
                        className="mt-0.5 size-5 shrink-0 accent-[#1E8E4F]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{permission.label}</span>
                        <span className="block text-sm text-gray-600 dark:text-[#9FB3B7]">{permission.hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={back} className={`${btnGhost} inline-flex items-center`}>Cancel</Link>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving..." : role ? "Save role" : "Add role"}
        </button>
      </div>
    </form>
  );
}
