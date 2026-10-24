"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError, Modal, btnGhost, btnPrimary, inputClass } from "@/components/admin/modal";
import type { Role, StaffMember } from "@/lib/admin/roles";
import type { ActionResult } from "@/app/admin/users/roles/actions";

export function AddStaffDialog({
  roles,
  onSubmit,
  onClose,
}: {
  roles: Role[];
  onSubmit: (identifier: string, roleId: string) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const [identifier, setIdentifier] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!identifier.trim()) {
      setError("Enter a username, email, phone number or Spurs ID.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await onSubmit(identifier, roleId);
        if (result.ok) {
          toast.success("Staff member added");
          onClose();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[roles] Failed to add staff", cause);
        setError("Could not add the staff member. Please try again.");
      }
    });
  }

  return (
    <Modal title="Add staff member" onClose={() => { if (!pending) onClose(); }}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <FormError>{error}</FormError> : null}
        <Field
          id={`${base}-who`}
          label="Username, email, phone or Spurs ID"
          hint="They must have logged in to Spur VTU at least once."
        >
          <input
            id={`${base}-who`}
            autoFocus
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            maxLength={100}
            autoComplete="off"
            className={inputClass()}
          />
        </Field>
        <Field id={`${base}-role`} label="Role">
          <select id={`${base}-role`} value={roleId} onChange={(event) => setRoleId(event.target.value)} className={inputClass()}>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={pending} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={pending || roles.length === 0} className={btnPrimary}>
            {pending ? "Adding..." : "Add staff"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ChangeRoleDialog({
  member,
  roles,
  onSubmit,
  onClose,
}: {
  member: StaffMember;
  roles: Role[];
  onSubmit: (roleId: string) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const base = useId();
  const [roleId, setRoleId] = useState(member.roleId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await onSubmit(roleId);
        if (result.ok) {
          toast.success("Role changed");
          onClose();
        } else {
          setError(result.error);
        }
      } catch (cause) {
        console.error("[roles] Failed to change role", cause);
        setError("Could not change the role. Please try again.");
      }
    });
  }

  return (
    <Modal title={`Change role for ${member.name || member.username || "staff member"}`} onClose={() => { if (!pending) onClose(); }}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <FormError>{error}</FormError> : null}
        <Field id={`${base}-role`} label="Role">
          <select id={`${base}-role`} value={roleId} onChange={(event) => setRoleId(event.target.value)} className={inputClass()}>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={pending} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={pending || roleId === member.roleId} className={btnPrimary}>
            {pending ? "Saving..." : "Save role"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
