"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { btnIcon, btnPrimary } from "@/components/admin/modal";
import { ConfirmDialog } from "@/components/admin/airtime-data/dialogs";
import { formatNaira, formatNumber } from "@/lib/format";
import type { Package } from "@/lib/admin/packages";
import { createPackage, removePackage, updatePackage } from "@/app/admin/users/packages/actions";
import { PackageDialog } from "./package-dialog";

type Dialog = { kind: "add" } | { kind: "edit"; pkg: Package } | { kind: "delete"; pkg: Package } | null;

const th = "px-3 py-3 text-left text-sm font-medium text-gray-600 dark:text-[#9FB3B7] sm:px-5";
const td = "px-3 py-4 sm:px-5";

export function PackagesManager({ packages }: { packages: Package[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const nextOrder = Math.max(0, ...packages.map((item) => item.sortOrder)) + 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDialog({ kind: "add" })}
          className={`${btnPrimary} inline-flex items-center gap-2`}
        >
          <Plus className="size-5" aria-hidden="true" />
          Add package
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Packages</caption>
          <thead className="border-b border-gray-200 dark:border-white/10">
            <tr>
              <th scope="col" className={th}>Package</th>
              <th scope="col" className={`${th} text-right`}>Order</th>
              <th scope="col" className={`${th} text-right`}>Upgrade fee</th>
              <th scope="col" className={`${th} text-right`}>Customers</th>
              <th scope="col" className={`${th} text-right`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {packages.map((pkg) => (
              <tr key={pkg.id}>
                <td className={td}>
                  <p className="flex items-center gap-2 font-medium">
                    {pkg.name}
                    {pkg.isDefault && (
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-white/10">
                        Default
                      </span>
                    )}
                  </p>
                  {pkg.description && <p className="text-gray-600 dark:text-[#9FB3B7]">{pkg.description}</p>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{pkg.sortOrder}</td>
                <td className={`${td} text-right tabular-nums`}>{pkg.upgradeFee > 0 ? formatNaira(pkg.upgradeFee) : "Free"}</td>
                <td className={`${td} text-right tabular-nums`}>{formatNumber(pkg.customers)}</td>
                <td className={td}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "edit", pkg })}
                      aria-label={`Edit ${pkg.name}`}
                      title="Edit"
                      className={btnIcon}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "delete", pkg })}
                      aria-label={`Delete ${pkg.name}`}
                      title="Delete"
                      disabled={pkg.isDefault}
                      className={`${btnIcon} disabled:cursor-not-allowed disabled:opacity-40`}
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

      {dialog?.kind === "add" && (
        <PackageDialog
          nextOrder={nextOrder}
          onClose={close}
          onSubmit={async (input) => {
            const result = await createPackage(input);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      {dialog?.kind === "edit" && (
        <PackageDialog
          pkg={dialog.pkg}
          nextOrder={nextOrder}
          onClose={close}
          onSubmit={async (input) => {
            const result = await updatePackage(dialog.pkg.id, input);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title={`Delete ${dialog.pkg.name}?`}
          text={
            dialog.pkg.customers > 0
              ? `${dialog.pkg.customers} customers are on this package. Move them to another package before deleting it.`
              : "This also removes this package's prices on every data plan."
          }
          confirmLabel="Delete package"
          onClose={close}
          onConfirm={async () => {
            const result = await removePackage(dialog.pkg.id);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
    </div>
  );
}
