"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/dashboard/copy-button";
import { API_SCOPES, type ApiKeyRecord, type ApiScope } from "@/lib/api/keys";
import { formatWhen } from "@/lib/format";
import { createKey, revokeKey } from "./actions";

const input = "h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";

export function KeyManager({ keys }: { keys: ApiKeyRecord[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(["balance", "catalog", "purchase", "transactions"]);
  const [ips, setIps] = useState("");
  const [error, setError] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError("");
    startTransition(async () => {
      try {
        const result = await createKey({ name, scopes, ipAllowlist: ips });
        if (!result.ok) return setError(result.error);
        setSecret(result.key);
        setName("");
        setIps("");
        router.refresh();
      } catch {
        setError("Could not create the key. Please try again.");
      }
    });
  }

  function revoke(id: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await revokeKey(id);
        if (!result.ok) return setError(result.error);
        router.refresh();
      } catch {
        setError("Could not revoke the key. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {secret && (
        <div role="status" className="rounded-2xl border border-[#F2B632]/60 bg-[#FFF8E1] p-5 dark:border-[#F2B632]/30 dark:bg-[#F2B632]/10">
          <p className="font-semibold text-[#12343B] dark:text-[#EEF3F4]">Copy your key now</p>
          <p className="mt-1 text-sm text-[#5C4A12] dark:text-[#D9C48A]">It won&apos;t be shown again. Store it like a password.</p>
          <p className="mt-3 break-all rounded-lg bg-white p-3 font-mono text-xs dark:bg-black/30">{secret}</p>
          <div className="mt-3 flex gap-3">
            <CopyButton value={secret} label="Copy key" />
            <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setSecret(null)}>I&apos;ve saved it</button>
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-semibold">Create a key</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Name</span>
            <input className={input} value={name} maxLength={40} placeholder="My WhatsApp bot" onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Permissions</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {API_SCOPES.map((scope) => (
                <label key={scope.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={scopes.includes(scope.id)} onChange={(e) =>
                    setScopes((current) => (e.target.checked ? [...current, scope.id] : current.filter((s) => s !== scope.id)))
                  } />
                  {scope.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Allowed IP addresses</span>
            <input className={input} value={ips} placeholder="Optional. Separate with commas." onChange={(e) => setIps(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
          <button type="button" disabled={pending} onClick={create} className="h-11 rounded-xl bg-[#F2B632] px-5 text-sm font-semibold text-[#12343B] hover:bg-[#E5A720] disabled:opacity-60">
            {pending ? "Working..." : "Create key"}
          </button>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        {keys.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No active keys.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-white/10">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{key.name}</p>
                  <p className="font-mono text-xs text-gray-600 dark:text-[#9FB3B7]">{key.prefix}…</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-[#9FB3B7]">
                    {key.scopes.join(", ")} · {key.ipAllowlist.length ? key.ipAllowlist.join(", ") : "Any IP"} · {key.lastUsedAt ? `Used ${formatWhen(key.lastUsedAt)}` : "Never used"}
                  </p>
                </div>
                <button type="button" disabled={pending} onClick={() => revoke(key.id)} className="rounded-lg border border-[#C8432B] px-3 py-2 text-[#C8432B] disabled:opacity-60">Revoke</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
