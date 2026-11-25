"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { previewAudience, sendBroadcast } from "@/app/admin/announcements/broadcast/actions";
import { Modal, btnGhost, btnPrimary } from "@/components/admin/modal";
import {
  AUDIENCES, CHANNELS, SMS_LIMIT, type Audience, type BroadcastRecord, type Channel, type ChannelAvailability,
} from "@/lib/admin/announcements";
import { formatNumber, formatWhen } from "@/lib/format";

const input =
  "w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:border-white/15 dark:bg-[#10262B]";
const STATUS_STYLE: Record<BroadcastRecord["status"], string> = {
  sending: "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300",
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-300",
};
const STATUS_LABEL = { sending: "Sending", sent: "Sent", failed: "Failed" } as const;
const channelLabel = (id: Channel) => CHANNELS.find((c) => c.id === id)?.label ?? id;

export function BroadcastManager({
  history,
  availability,
  packages,
}: {
  history: BroadcastRecord[];
  availability: ChannelAvailability;
  packages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["system"]);
  const [audience, setAudience] = useState<Audience>("all");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const anySending = history.some((item) => item.status === "sending");

  useEffect(() => {
    if (!anySending) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [anySending, router]);

  const toggle = (channel: Channel) =>
    setChannels((current) => (current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel]));

  function review(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !body.trim()) return setError("Add a title and a message.");
    if (channels.length === 0) return setError("Choose at least one channel.");
    if (channels.includes("sms") && body.length > SMS_LIMIT) return setError(`SMS messages can be up to ${SMS_LIMIT} characters.`);
    startTransition(async () => {
      const result = await previewAudience(audience, audience === "package" ? packageId : null);
      if (!result.ok) return setError(result.error);
      if (result.count === 0) return setError("No customers match that audience.");
      setConfirm(result.count);
    });
  }

  function send() {
    startTransition(async () => {
      const result = await sendBroadcast({ title, body, channels, audience, packageId: audience === "package" ? packageId : null });
      setConfirm(null);
      if (!result.ok) return setError(result.error);
      toast.success("Broadcast is sending.");
      setTitle("");
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <form onSubmit={review} className="h-fit space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">New broadcast</h2>
        <label className="block text-sm font-medium">
          Title
          <input className={`${input} mt-1 h-11`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Message
          <textarea className={`${input} mt-1 min-h-32 py-2`} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <p className="-mt-2 text-xs text-gray-600 dark:text-[#9FB3B7]">
          Use {"{name}"} to address each customer by first name. SMS uses only the message and is limited to {SMS_LIMIT} characters
          {channels.includes("sms") && ` (${body.length} now)`}.
        </p>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Send by</legend>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map((meta) => {
              const status = availability[meta.id];
              return (
                <label key={meta.id} title={status.available ? meta.hint : status.reason}
                  className={`flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-white/15 ${status.available ? "cursor-pointer" : "opacity-50"}`}>
                  <input type="checkbox" disabled={!status.available} checked={channels.includes(meta.id)} onChange={() => toggle(meta.id)} />
                  {meta.label}
                </label>
              );
            })}
          </div>
          {CHANNELS.some((c) => !availability[c.id].available) && (
            <p className="mt-2 text-xs text-gray-600 dark:text-[#9FB3B7]">Greyed-out channels aren&apos;t set up yet. Hover for what&apos;s needed.</p>
          )}
        </fieldset>
        <label className="block text-sm font-medium">
          Send to
          <select className={`${input} mt-1 h-11`} value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        {audience === "package" && (
          <label className="block text-sm font-medium">
            Package
            <select className={`${input} mt-1 h-11`} value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        {error && <p role="alert" className="text-sm text-[#C8432B]">{error}</p>}
        <button type="submit" className={`${btnPrimary} w-full`} disabled={pending}>
          {pending && confirm === null ? "Checking..." : "Review and send"}
        </button>
      </form>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
        <h2 className="border-b border-gray-200 px-5 py-4 font-[family-name:var(--font-display)] text-lg font-bold dark:border-white/10">History</h2>
        {history.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-[#9FB3B7]">No broadcasts yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-white/10">
            {history.map((item) => (
              <li key={item.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{item.title}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                    {item.status === "sending" && ` ${formatNumber(item.processed)}/${formatNumber(item.total)}`}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-[#9FB3B7]">
                  {formatWhen(item.createdAt)} ·{" "}
                  {item.audience === "package" ? `${item.packageName ?? "Package"} customers` : AUDIENCES.find((a) => a.id === item.audience)?.label} ·{" "}
                  {formatNumber(item.total)} recipients
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {item.channels.map((channel) => {
                    const r = item.results[channel];
                    return (
                      <span key={channel} className="rounded-md bg-gray-100 px-2 py-1 dark:bg-white/10">
                        {channelLabel(channel)}: {formatNumber(r?.sent ?? 0)} sent
                        {r && r.failed > 0 && `, ${formatNumber(r.failed)} failed`}
                        {r && r.skipped > 0 && `, ${formatNumber(r.skipped)} skipped`}
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirm !== null && (
        <Modal title="Send this broadcast?" onClose={() => !pending && setConfirm(null)}>
          <p className="text-sm text-gray-600 dark:text-[#9FB3B7]">
            This goes to <strong className="text-[#12343B] dark:text-[#EEF3F4]">{formatNumber(confirm)}</strong>{" "}
            {confirm === 1 ? "customer" : "customers"} by {channels.map(channelLabel).join(", ")}. It can&apos;t be recalled once sent.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={btnGhost} disabled={pending} onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className={btnPrimary} disabled={pending} onClick={send}>
              {pending ? "Starting..." : "Send now"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
