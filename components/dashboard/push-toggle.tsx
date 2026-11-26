"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { subscribePush, unsubscribePush } from "@/app/dashboard/profile/push-actions";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function keyToBytes(base64: string) {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const button =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold outline-none hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10 dark:focus-visible:ring-[#F2B632]";

export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function check() {
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState("unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = await registration?.pushManager.getSubscription();
        setState(existing ? "on" : "off");
      } catch {
        setState("off");
      }
    }
    void check();
  }, [publicKey]);

  function enable() {
    startTransition(async () => {
      try {
        if ((await Notification.requestPermission()) !== "granted") {
          setState(Notification.permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyToBytes(publicKey!),
          }));
        const json = subscription.toJSON();
        const result = await subscribePush({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        });
        if (!result.ok) {
          await subscription.unsubscribe().catch(() => undefined);
          return void toast.error(result.error);
        }
        setState("on");
        toast.success("Push notifications are on for this device");
      } catch (error) {
        console.error("[push] enable", error);
        toast.error("Could not turn on push notifications on this device.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await unsubscribePush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setState("off");
        toast.success("Push notifications are off for this device");
      } catch {
        toast.error("Could not turn them off. Try again.");
      }
    });
  }

  if (state === "loading") return null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <h2 className="font-semibold">Push notifications</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">
        {state === "unsupported" && "This browser or device can't receive push notifications. On iPhone, add Spur VTU to your Home Screen first."}
        {state === "denied" && "Notifications are blocked for this site. Allow them in your browser settings, then come back."}
        {(state === "off" || state === "on") && "Get purchase updates on this device, even when the site is closed. What you receive follows your notification settings above."}
      </p>
      {state === "off" && (
        <button type="button" className={`${button} mt-4`} onClick={enable} disabled={isPending}>
          <Bell className="size-4" aria-hidden="true" /> {isPending ? "Turning on..." : "Turn on for this device"}
        </button>
      )}
      {state === "on" && (
        <button type="button" className={`${button} mt-4`} onClick={disable} disabled={isPending}>
          <BellOff className="size-4" aria-hidden="true" /> {isPending ? "Turning off..." : "Turn off for this device"}
        </button>
      )}
    </section>
  );
}
