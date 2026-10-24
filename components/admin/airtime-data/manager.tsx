"use client";

import { useState, useTransition } from "react";
import { Tabs } from "@/components/admin/tabs";
import type { NetworkId, NetworkProduct } from "@/lib/admin/airtime-data";
import { setNetworkEnabled } from "@/app/admin/products/airtime-data/actions";
import {
  AirtimeDiscountPanel,
  DataPlansPanel,
  NetworkTypesPanel,
  PinsPanel,
  Switch,
  type Commit,
} from "./panels";

const SECTIONS = [
  { id: "types", label: "Network types" },
  { id: "discount", label: "Airtime discount" },
  { id: "plans", label: "Data plans" },
  { id: "airtime-pins", label: "Airtime pins" },
  { id: "data-pins", label: "Data pins" },
];

export function AirtimeDataManager({ networks: initial }: { networks: NetworkProduct[] }) {
  const [networks, setNetworks] = useState(initial);
  const [networkId, setNetworkId] = useState<NetworkId>(initial[0]?.id ?? "mtn");
  const [section, setSection] = useState(SECTIONS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const commit: Commit = (next, run) => {
    const previous = networks;
    setError(null);
    setNetworks((current) => current.map((n) => (n.id === next.id ? next : n)));
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setNetworks(previous);
        setError(result.error);
      }
    });
  };

  const network = networks.find((n) => n.id === networkId) ?? networks[0];
  if (!network) return null;

  const networkTabs = networks.map((n) => ({
    id: n.id,
    label: (
      <span className="flex items-center gap-2">
        {n.name}
        {!n.enabled && (
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

      <Tabs label="Network" tabs={networkTabs} value={network.id} onChange={(id) => setNetworkId(id as NetworkId)}>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5 sm:px-5">
            <div className="min-w-0">
              <p className="font-medium">{network.name} is {network.enabled ? "on" : "off"}</p>
              <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
                {network.enabled ? "Customers can buy from this network." : "Customers can't buy from this network."}
              </p>
            </div>
            <Switch
              checked={network.enabled}
              label={`${network.name} enabled`}
              onChange={(next) => commit({ ...network, enabled: next }, () => setNetworkEnabled(network.id, next))}
            />
          </div>

          <Tabs label={`${network.name} settings`} tabs={SECTIONS} value={section} onChange={setSection} variant="pill">
            <div key={`${network.id}-${section}`}>
              {section === "types" && <NetworkTypesPanel network={network} commit={commit} />}
              {section === "discount" && <AirtimeDiscountPanel network={network} commit={commit} />}
              {section === "plans" && <DataPlansPanel network={network} commit={commit} />}
              {section === "airtime-pins" && <PinsPanel kind="airtime" network={network} />}
              {section === "data-pins" && <PinsPanel kind="data" network={network} />}
            </div>
          </Tabs>
        </div>
      </Tabs>
    </div>
  );
}
