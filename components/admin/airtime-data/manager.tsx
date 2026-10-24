"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Tabs } from "@/components/admin/tabs";
import { btnIcon, btnPrimary } from "@/components/admin/modal";
import type { DataTypeOption, NetworkProduct } from "@/lib/admin/airtime-data";
import {
  createNetwork,
  removeNetwork,
  renameNetwork,
  setNetworkEnabled,
} from "@/app/admin/products/airtime-data/actions";
import { ConfirmDialog, NameDialog } from "./dialogs";
import {
  DataPlansPanel,
  DiscountsPanel,
  NetworkTypesPanel,
  PinsPanel,
  Switch,
  type Commit,
} from "./panels";

const SECTIONS = [
  { id: "types", label: "Network types" },
  { id: "discounts", label: "Airtime discounts" },
  { id: "plans", label: "Data plans" },
  { id: "airtime-pins", label: "Airtime pins" },
  { id: "data-pins", label: "Data pins" },
];

type Dialog = "add" | "rename" | "delete" | null;

export function AirtimeDataManager({
  networks: initial,
  types,
  initialNetwork,
  initialSection,
}: {
  networks: NetworkProduct[];
  types: DataTypeOption[];
  initialNetwork?: string;
  initialSection?: string;
}) {
  const [networks, setNetworks] = useState(initial);
  const [networkId, setNetworkId] = useState(
    initial.find((network) => network.id === initialNetwork)?.id ?? initial[0]?.id ?? "",
  );
  const [section, setSection] = useState(
    SECTIONS.find((item) => item.id === initialSection)?.id ?? SECTIONS[0].id,
  );
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setNetworks(initial);
    setNetworkId((current) => initial.some((network) => network.id === current)
      ? current
      : initial.find((network) => network.id === initialNetwork)?.id ?? initial[0]?.id ?? "");
  }, [initial, initialNetwork]);

  const commit: Commit = (next, run) => {
    const previous = networks;
    setError(null);
    setNetworks((current) => current.map((network) => (network.id === next.id ? next : network)));
    startTransition(async () => {
      try {
        const result = await run();
        if (!result.ok) {
          setNetworks(previous);
          setError(result.error);
        }
      } catch (cause) {
        console.error("[airtime-data] Failed to save changes", cause);
        setNetworks(previous);
        setError("Could not save changes. Please try again.");
      }
    });
  };

  const network = networks.find((item) => item.id === networkId) ?? networks[0];
  const networkTabs = networks.map((item) => ({
    id: item.id,
    label: (
      <span className="flex items-center gap-2">
        {item.name}
        {!item.enabled && (
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-[#9FB3B7]">
            Off
          </span>
        )}
      </span>
    ),
  }));

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl border border-[#C8432B] bg-white px-4 py-3 text-sm text-[#C8432B]">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => setDialog("add")} className={`${btnPrimary} inline-flex items-center gap-2`}>
          <Plus className="size-5" aria-hidden="true" />
          Add network
        </button>
      </div>

      {!network ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <p className="font-medium">No networks yet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
            Add your first network to start setting up plans.
          </p>
        </div>
      ) : (
        <Tabs label="Network" tabs={networkTabs} value={network.id} onChange={setNetworkId}>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5 sm:px-5">
              <div className="min-w-0">
                <p className="font-medium">
                  {network.name} is {network.enabled ? "on" : "off"}
                </p>
                <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
                  {network.enabled ? "Customers can buy from this network." : "Customers can't buy from this network."}
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setDialog("rename")}
                  aria-label={`Rename ${network.name}`}
                  title="Rename"
                  className={btnIcon}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDialog("delete")}
                  aria-label={`Delete ${network.name}`}
                  title="Delete"
                  className={btnIcon}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
                <Switch
                  checked={network.enabled}
                  label={`${network.name} enabled`}
                  onChange={(next) => commit({ ...network, enabled: next }, () => setNetworkEnabled(network.id, next))}
                />
              </div>
            </div>

            <Tabs label={`${network.name} settings`} tabs={SECTIONS} value={section} onChange={setSection} variant="pill">
              <div key={`${network.id}-${section}`}>
                {section === "types" && <NetworkTypesPanel network={network} types={types} commit={commit} />}
                {section === "discounts" && <DiscountsPanel network={network} types={types} commit={commit} />}
                {section === "plans" && <DataPlansPanel network={network} types={types} commit={commit} />}
                {section === "airtime-pins" && <PinsPanel kind="airtime" network={network} />}
                {section === "data-pins" && <PinsPanel kind="data" network={network} />}
              </div>
            </Tabs>
          </div>
        </Tabs>
      )}

      {dialog === "add" && (
        <NameDialog
          title="Add network"
          label="Network name"
          submitLabel="Add network"
          hint="New networks start switched on with every network type enabled."
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const result = await createNetwork(name);
            if (result.ok && result.id) {
              setNetworkId(result.id);
              setSection(SECTIONS[0].id);
            }
            return result;
          }}
        />
      )}

      {dialog === "rename" && network && (
        <NameDialog
          title={`Rename ${network.name}`}
          label="Network name"
          initial={network.name}
          submitLabel="Save name"
          onClose={() => setDialog(null)}
          onSubmit={(name) => renameNetwork(network.id, name)}
        />
      )}

      {dialog === "delete" && network && (
        <ConfirmDialog
          title={`Delete ${network.name}?`}
          text={`This permanently removes ${network.name} with its plans, discounts and pin stock. To just stop sales, switch the network off instead.`}
          confirmLabel="Delete network"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const result = await removeNetwork(network.id);
            if (result.ok) setNetworkId(networks.find((item) => item.id !== network.id)?.id ?? "");
            return result;
          }}
        />
      )}
    </div>
  );
}
