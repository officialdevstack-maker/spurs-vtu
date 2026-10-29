"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Tabs } from "@/components/admin/tabs";
import { btnIcon, btnPrimary } from "@/components/admin/modal";
import { Switch } from "@/components/admin/airtime-data/panels";
import { ConfirmDialog } from "@/components/admin/airtime-data/dialogs";
import {
  authLabel,
  kindLabel,
  PROVIDER_SERVICES,
  serviceLabel,
  type Provider,
  type ProviderEndpoint,
} from "@/lib/admin/providers";
import {
  createProvider,
  removeEndpoint,
  removeProvider,
  saveEndpoint,
  saveNetworkCodes,
  setEndpointActive,
  setProviderEnabled,
  updateProvider,
  type ActionResult,
} from "@/app/admin/gateways/providers/actions";
import { EndpointDialog } from "./endpoint-dialog";
import { NetworkCodesDialog } from "./network-codes-dialog";
import { ProviderDialog } from "./provider-dialog";

type Dialog =
  | { kind: "add-provider" }
  | { kind: "edit-provider" }
  | { kind: "delete-provider" }
  | { kind: "add-endpoint" }
  | { kind: "edit-endpoint"; endpoint: ProviderEndpoint }
  | { kind: "delete-endpoint"; endpoint: ProviderEndpoint }
  | { kind: "network-codes" }
  | null;

const th = "px-3 py-3 text-left text-sm font-medium text-gray-600 dark:text-[#9FB3B7] sm:px-5";
const td = "px-3 py-4 sm:px-5";

function OnOff({ on }: { on: boolean }) {
  return <span className="w-7 text-sm text-gray-600 dark:text-[#9FB3B7]">{on ? "On" : "Off"}</span>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-gray-600 dark:text-[#9FB3B7]">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{children}</dd>
    </div>
  );
}

export function ProvidersManager({
  providers,
  networks,
  initialProvider,
}: {
  providers: Provider[];
  networks: { id: string; name: string }[];
  initialProvider?: string;
}) {
  const router = useRouter();
  const [providerId, setProviderId] = useState(
    providers.find((item) => item.id === initialProvider)?.id ?? providers[0]?.id ?? "",
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const provider = providers.find((item) => item.id === providerId) ?? providers[0];
  const close = () => setDialog(null);
  const canAddEndpoint = !!provider && provider.endpoints.length < PROVIDER_SERVICES.length;

  function perform(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) router.refresh();
        else setError(result.error);
      } catch (cause) {
        console.error("[providers] Failed to save changes", cause);
        setError("Could not save changes. Please try again.");
      }
    });
  }

  const tabs = providers.map((item) => ({
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
        <button
          type="button"
          onClick={() => setDialog({ kind: "add-provider" })}
          className={`${btnPrimary} inline-flex items-center gap-2`}
        >
          <Plus className="size-5" aria-hidden="true" />
          Add provider
        </button>
      </div>

      {!provider ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <p className="font-medium">No providers yet</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
            Add your first provider, then set up the service endpoints it offers.
          </p>
        </div>
      ) : (
        <Tabs label="Provider" tabs={tabs} value={provider.id} onChange={setProviderId}>
          <div className="space-y-6">
            <section
              aria-label={`${provider.name} details`}
              className="rounded-2xl border border-gray-200 bg-gray-100 p-4 dark:border-white/10 dark:bg-white/5 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {provider.name} is {provider.enabled ? "on" : "off"}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
                    {provider.enabled
                      ? "Purchases can be sent to this provider."
                      : "No purchases are sent to this provider."}
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: "edit-provider" })}
                    aria-label={`Edit ${provider.name}`}
                    title="Edit"
                    className={btnIcon}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: "delete-provider" })}
                    aria-label={`Delete ${provider.name}`}
                    title="Delete"
                    className={btnIcon}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                  <Switch
                    checked={provider.enabled}
                    label={`${provider.name} enabled`}
                    onChange={(enabled) => perform(() => setProviderEnabled(provider.id, enabled))}
                  />
                </div>
              </div>

              <dl className="mt-5 grid gap-4 border-t border-gray-200 pt-5 text-sm dark:border-white/10 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Type">{kindLabel(provider.kind)}</Detail>
                <Detail label="Base address">
                  <span className="font-[family-name:var(--font-geist-mono)] text-sm">{provider.baseUrl}</span>
                </Detail>
                <Detail label="Authentication">{authLabel(provider.authType)}</Detail>
                <Detail label="Secret">
                  {provider.authType === "none" ? "Not needed" : provider.hasSecret ? "Saved (hidden)" : "Not set"}
                </Detail>
                <Detail label="Priority">{provider.priority}</Detail>
                <Detail label="Timeout">{(provider.timeoutMs / 1000).toLocaleString("en-NG")}s</Detail>
              </dl>
            </section>

            <section aria-labelledby="network-codes-heading" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 id="network-codes-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
                    Network codes
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
                    Match this provider’s own network IDs for each Spur network.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "network-codes" })}
                  className={btnIcon}
                  aria-label={`Edit network codes for ${provider.name}`}
                  title="Edit network codes"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              </div>

              {networks.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">No networks available yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {networks.map((network) => (
                    <div key={network.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-black/10">
                      <div className="text-sm font-medium">{network.name}</div>
                      <div className="mt-1 font-[family-name:var(--font-geist-mono)] text-sm text-gray-600 dark:text-[#9FB3B7]">
                        {provider.networkCodes[network.id] ?? "Not set"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="endpoints-heading">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 id="endpoints-heading" className="font-[family-name:var(--font-display)] text-lg font-bold">
                    Service endpoints
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
                    The services {provider.name} can fulfil. Turn an endpoint off to stop using it for that service.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "add-endpoint" })}
                  disabled={!canAddEndpoint}
                  className={`${btnPrimary} inline-flex shrink-0 items-center gap-2`}
                >
                  <Plus className="size-5" aria-hidden="true" />
                  Add endpoint
                </button>
              </div>

              {provider.endpoints.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
                  <Receipt className="mx-auto size-8 text-gray-400" aria-hidden="true" />
                  <p className="mt-3 font-medium">No endpoints yet</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
                    Add the services this provider supports, like airtime or data.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead className="border-b border-gray-200 dark:border-white/10">
                      <tr>
                        <th scope="col" className={th}>Service</th>
                        <th scope="col" className={th}>Request</th>
                        <th scope="col" className={`${th} text-right`}>Active</th>
                        <th scope="col" className={`${th} text-right`}>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                      {provider.endpoints.map((endpoint) => (
                        <tr key={endpoint.id}>
                          <td className={`${td} font-medium`}>{serviceLabel(endpoint.service)}</td>
                          <td className={td}>
                            <span className="mr-2 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold dark:bg-white/10">
                              {endpoint.method}
                            </span>
                            <span className="font-[family-name:var(--font-geist-mono)] text-sm">{endpoint.path}</span>
                          </td>
                          <td className={td}>
                            <div className="flex items-center justify-end gap-3">
                              <OnOff on={endpoint.active} />
                              <Switch
                                checked={endpoint.active}
                                label={`${serviceLabel(endpoint.service)} endpoint on ${provider.name}`}
                                onChange={(active) =>
                                  perform(() => setEndpointActive(provider.id, endpoint.id, active))
                                }
                              />
                            </div>
                          </td>
                          <td className={td}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setDialog({ kind: "edit-endpoint", endpoint })}
                                aria-label={`Edit ${serviceLabel(endpoint.service)} endpoint`}
                                title="Edit"
                                className={btnIcon}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDialog({ kind: "delete-endpoint", endpoint })}
                                aria-label={`Delete ${serviceLabel(endpoint.service)} endpoint`}
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
          </div>
        </Tabs>
      )}

      {dialog?.kind === "add-provider" && (
        <ProviderDialog
          onClose={close}
          onSubmit={async (input) => {
            const result = await createProvider(input);
            if (result.ok && result.id) setProviderId(result.id);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      {dialog?.kind === "edit-provider" && provider && (
        <ProviderDialog
          provider={provider}
          onClose={close}
          onSubmit={async (input) => {
            const result = await updateProvider(provider.id, input);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      {dialog?.kind === "delete-provider" && provider && (
        <ConfirmDialog
          title={`Delete ${provider.name}?`}
          text={`This permanently removes ${provider.name}, its saved secret and all of its endpoints. To just stop using it, switch it off instead.`}
          confirmLabel="Delete provider"
          onClose={close}
          onConfirm={async () => {
            const result = await removeProvider(provider.id);
            if (result.ok) {
              setProviderId(providers.find((item) => item.id !== provider.id)?.id ?? "");
              router.refresh();
            }
            return result;
          }}
        />
      )}
      {dialog?.kind === "network-codes" && provider && (
        <NetworkCodesDialog
          provider={provider}
          networks={networks}
          onClose={close}
          onSubmit={async (input) => {
            const result = await saveNetworkCodes(provider.id, input);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      {dialog?.kind === "add-endpoint" && provider && (
        <EndpointDialog
          provider={provider}
          onClose={close}
          onSubmit={async (input) => {
            const result = await saveEndpoint(provider.id, input);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      {dialog?.kind === "edit-endpoint" && provider && (
        <EndpointDialog
          provider={provider}
          endpoint={dialog.endpoint}
          onClose={close}
          onSubmit={async (input) => {
            const result = await saveEndpoint(provider.id, input);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
      {dialog?.kind === "delete-endpoint" && provider && (
        <ConfirmDialog
          title={`Delete ${serviceLabel(dialog.endpoint.service)} endpoint?`}
          text={`${provider.name} will no longer be used for ${serviceLabel(dialog.endpoint.service).toLowerCase()}. To pause it, switch it off instead.`}
          confirmLabel="Delete endpoint"
          onClose={close}
          onConfirm={async () => {
            const result = await removeEndpoint(provider.id, dialog.endpoint.id);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      )}
    </div>
  );
}
